import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { parse as parseYaml } from "yaml";
import { CliContractsDocumentSchema } from "../schema.js";
import type { CliContractsDocument } from "../schema.js";
import { ParseError } from "../parser.js";
import { mergeCliContract } from "./merger.js";

export class ResolveError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error,
  ) {
    super(`${filePath}: ${message}`);
    this.name = "ResolveError";
  }
}

export interface ResolveResult {
  document: CliContractsDocument;
  sourcePath: string;
  basePaths: string[];
}

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeExtends(
  value: unknown,
): string | string[] | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return undefined;
}

async function readRawContract(
  filePath: string,
): Promise<{ data: AnyRecord; filePath: string }> {
  const absPath = resolvePath(filePath);
  let content: string;
  try {
    content = await readFile(absPath, "utf-8");
  } catch (err) {
    throw new ResolveError(
      `Cannot read file: ${(err as Error).message}`,
      absPath,
      err as Error,
    );
  }

  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (err) {
    throw new ResolveError(
      `Invalid YAML: ${(err as Error).message}`,
      absPath,
      err as Error,
    );
  }

  if (!isRecord(raw)) {
    throw new ResolveError("Contract must be a YAML object", absPath);
  }

  return { data: raw, filePath: absPath };
}

function validateResolved(
  data: AnyRecord,
  filePath: string,
): CliContractsDocument {
  const result = CliContractsDocumentSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const lines = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  ${path}: ${issue.message}`;
  });
  throw new ResolveError(
    `Schema validation failed:\n${lines.join("\n")}`,
    filePath,
  );
}

async function resolveSingleBase(
  extendsPath: string,
  projectDir: string,
  seen: Set<string>,
): Promise<{ data: AnyRecord; basePaths: string[] }> {
  const absPath = resolvePath(projectDir, extendsPath);

  if (seen.has(absPath)) {
    throw new ResolveError(
      `Circular extends detected: ${absPath}`,
      absPath,
    );
  }
  seen.add(absPath);

  const baseResult = await readRawContract(absPath);
  return resolveExtendsChain(baseResult.data, baseResult.filePath, seen);
}

async function resolveExtendsChain(
  data: AnyRecord,
  filePath: string,
  seen: Set<string>,
): Promise<{ data: AnyRecord; basePaths: string[] }> {
  const extendsValue = normalizeExtends(data["extends"]);
  if (!extendsValue) {
    return { data, basePaths: [] };
  }

  const projectDir = dirname(filePath);
  let resolvedBase: AnyRecord = {};
  const basePaths: string[] = [];

  const paths = Array.isArray(extendsValue) ? extendsValue : [extendsValue];

  for (const extPath of paths) {
    const { data: chainData, basePaths: chainPaths } = await resolveSingleBase(
      extPath,
      projectDir,
      new Set(seen),
    );
    resolvedBase = mergeCliContract(resolvedBase, chainData);
    basePaths.push(...chainPaths, resolvePath(projectDir, extPath));
  }

  const merged = mergeCliContract(resolvedBase, data);
  return { data: merged, basePaths };
}

export async function resolveContractRaw(
  raw: AnyRecord,
  filePath: string,
): Promise<ResolveResult> {
  const { data, basePaths } = await resolveExtendsChain(
    raw,
    resolvePath(filePath),
    new Set(),
  );
  const document = validateResolved(data, filePath);
  return {
    document,
    sourcePath: resolvePath(filePath),
    basePaths,
  };
}

export async function resolveContractFile(
  filePath: string,
): Promise<ResolveResult> {
  const { data, filePath: absPath } = await readRawContract(filePath);
  const result = await resolveContractRaw(data, absPath);
  return { ...result, sourcePath: absPath };
}

export async function resolveContractString(
  content: string,
  filePath = "<string>",
): Promise<ResolveResult> {
  let raw: unknown;
  try {
    raw = parseYaml(content);
  } catch (err) {
    throw new ParseError(
      `Invalid YAML: ${(err as Error).message}`,
      filePath,
      err as Error,
    );
  }

  if (!isRecord(raw)) {
    throw new ParseError("Contract must be a YAML object", filePath);
  }

  return resolveContractRaw(raw, filePath);
}
