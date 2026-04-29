import type { CliContractsDocument, JsonSchema } from "./types.js";

export class RefResolutionError extends Error {
  constructor(
    public readonly ref: string,
    message: string,
  ) {
    super(`Cannot resolve $ref "${ref}": ${message}`);
    this.name = "RefResolutionError";
  }
}

/**
 * Resolves internal `$ref` pointers (e.g. `#/components/schemas/Error`)
 * within a contract document. Returns a deep copy with all internal $refs
 * replaced by the referenced value.
 *
 * External `$ref` (file paths, URLs) are left as-is unless
 * `resolveExternal` is true (not yet implemented).
 */
export function resolveRefs(
  doc: CliContractsDocument,
  options: { resolveExternal?: boolean } = {},
): CliContractsDocument {
  const resolved = new Set<string>();
  return deepResolve(doc, doc, "", resolved, options) as CliContractsDocument;
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
 * Validates that all internal $ref pointers resolve to existing paths.
 */
export function validateRefs(
  doc: CliContractsDocument,
): { valid: boolean; unresolvedRefs: string[] } {
  const allRefs = collectRefs(doc);
  const unresolved: string[] = [];

  for (const ref of allRefs) {
    if (!ref.startsWith("#/")) continue;
    try {
      resolveJsonPointer(doc, ref.slice(1));
    } catch {
      unresolved.push(ref);
    }
  }

  return { valid: unresolved.length === 0, unresolvedRefs: unresolved };
}

function deepResolve(
  value: unknown,
  root: CliContractsDocument,
  path: string,
  resolved: Set<string>,
  options: { resolveExternal?: boolean },
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item, i) =>
      deepResolve(item, root, `${path}/${i}`, resolved, options),
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
      const result = deepResolve(target, root, ref, resolved, options);
      resolved.delete(ref);
      return result;
    }

    // External refs - leave as-is for now
    return obj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = deepResolve(val, root, `${path}/${key}`, resolved, options);
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
