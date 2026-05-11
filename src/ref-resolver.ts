import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CliContractsDocument } from "./types.js";

export class RefResolutionError extends Error {
  constructor(
    public readonly ref: string,
    message: string,
  ) {
    super(`Cannot resolve $ref "${ref}": ${message}`);
    this.name = "RefResolutionError";
  }
}

export interface ResolveRefsOptions {
  basePath?: string;
}

/**
 * Resolves `$ref` pointers within a contract document.
 *
 * - Internal refs (`#/components/schemas/Error`) are resolved against the
 *   document root.
 * - External file refs (`./path/to/file.yaml#/json/pointer`) are resolved
 *   relative to `basePath` (the directory containing the contract file).
 *   The referenced file is loaded, parsed as YAML, and the JSON pointer
 *   is resolved within it. Nested `$ref` inside the external document
 *   are resolved against that document's own root.
 *
 * Returns a deep copy with all $refs replaced by the referenced value.
 */
export function resolveRefs(
  doc: CliContractsDocument,
  options: ResolveRefsOptions = {},
): CliContractsDocument {
  const resolved = new Set<string>();
  const fileCache = new Map<string, unknown>();
  const basePath = options.basePath ?? process.cwd();
  return deepResolve(doc, doc, "", resolved, basePath, fileCache) as CliContractsDocument;
}

/**
 * Collects all `$ref` strings found in the document.
 */
export function collectRefs(obj: unknown): string[] {
  const refs: string[] = [];
  walk(obj, (value) => {
    if (
      value &&
      typeof value === "object" &&
      "$ref" in value &&
      typeof (value as Record<string, unknown>)["$ref"] === "string"
    ) {
      refs.push((value as Record<string, unknown>)["$ref"] as string);
    }
  });
  return refs;
}

/**
 * Validates that all $ref pointers resolve to existing paths.
 * Checks both internal (`#/`) and external file refs.
 */
export function validateRefs(
  doc: CliContractsDocument,
  options: { basePath?: string } = {},
): { valid: boolean; unresolvedRefs: string[] } {
  const allRefs = collectRefs(doc);
  const unresolved: string[] = [];
  const basePath = options.basePath ?? process.cwd();

  for (const ref of allRefs) {
    if (ref.startsWith("#/")) {
      try {
        resolveJsonPointer(doc, ref.slice(1));
      } catch {
        unresolved.push(ref);
      }
    } else if (ref.includes("#/")) {
      try {
        resolveExternalRef(ref, basePath, new Map());
      } catch {
        unresolved.push(ref);
      }
    }
  }

  return { valid: unresolved.length === 0, unresolvedRefs: unresolved };
}

function loadYamlFile(filePath: string, fileCache: Map<string, unknown>): unknown {
  const absPath = resolve(filePath);
  const cached = fileCache.get(absPath);
  if (cached !== undefined) return cached;

  try {
    const content = readFileSync(absPath, "utf-8");
    const parsed = parseYaml(content);
    fileCache.set(absPath, parsed);
    return parsed;
  } catch (err) {
    throw new RefResolutionError(
      filePath,
      `Cannot read external file: ${(err as Error).message}`,
    );
  }
}

function resolveExternalRef(
  ref: string,
  basePath: string,
  fileCache: Map<string, unknown>,
): unknown {
  const hashIndex = ref.indexOf("#/");
  const filePart = ref.slice(0, hashIndex);
  const pointer = ref.slice(hashIndex + 1);

  const absFilePath = resolve(basePath, filePart);
  const externalDoc = loadYamlFile(absFilePath, fileCache);
  return resolveJsonPointer(externalDoc, pointer);
}

function deepResolve(
  value: unknown,
  root: CliContractsDocument,
  path: string,
  resolved: Set<string>,
  basePath: string,
  fileCache: Map<string, unknown>,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      deepResolve(item, root, `${path}/${i}`, resolved, basePath, fileCache),
    );
  }

  const obj = value as Record<string, unknown>;

  if ("$ref" in obj && typeof obj["$ref"] === "string") {
    const ref = obj["$ref"] as string;

    if (ref.startsWith("#/")) {
      if (resolved.has(ref)) {
        throw new RefResolutionError(ref, "Circular reference detected");
      }
      resolved.add(ref);
      const pointer = ref.slice(1);
      const target = resolveJsonPointer(root, pointer);
      const result = deepResolve(target, root, ref, resolved, basePath, fileCache);
      resolved.delete(ref);
      return result;
    }

    if (ref.includes("#/")) {
      if (resolved.has(ref)) {
        throw new RefResolutionError(ref, "Circular reference detected");
      }
      resolved.add(ref);

      const hashIndex = ref.indexOf("#/");
      const filePart = ref.slice(0, hashIndex);
      const absFilePath = resolve(basePath, filePart);
      const externalDoc = loadYamlFile(absFilePath, fileCache);
      const pointer = ref.slice(hashIndex + 1);
      const target = resolveJsonPointer(externalDoc, pointer);

      const externalBasePath = dirname(absFilePath);
      const externalResolved = new Set<string>();
      const result = deepResolve(
        target,
        externalDoc as CliContractsDocument,
        ref,
        externalResolved,
        externalBasePath,
        fileCache,
      );
      resolved.delete(ref);
      return result;
    }

    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = deepResolve(val, root, `${path}/${key}`, resolved, basePath, fileCache);
  }
  return result;
}

function resolveJsonPointer(root: unknown, pointer: string): unknown {
  const segments = pointer
    .split("/")
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      throw new RefResolutionError(
        `#${pointer}`,
        `Cannot traverse into non-object at "${segment}"`,
      );
    }
    const obj = current as Record<string, unknown>;
    if (!(segment in obj)) {
      throw new RefResolutionError(
        `#${pointer}`,
        `Key "${segment}" not found`,
      );
    }
    current = obj[segment];
  }
  return current;
}

function walk(value: unknown, visitor: (v: unknown) => void): void {
  if (value === null || value === undefined) return;
  visitor(value);
  if (typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }

  for (const val of Object.values(value as Record<string, unknown>)) {
    walk(val, visitor);
  }
}
