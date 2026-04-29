import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { ZodType } from "zod";
import {
  CliContractsDocumentSchema,
  CliContractsConfigSchema,
} from "./schema.js";
import type { CliContractsDocument, CliContractsConfig } from "./schema.js";

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error,
  ) {
    super(`${filePath}: ${message}`);
    this.name = "ParseError";
  }
}

export async function parseContractFile(
  filePath: string,
): Promise<CliContractsDocument> {
  const content = await readFileContent(filePath);
  return parseContractString(content, filePath);
}

export function parseContractString(
  content: string,
  filePath = "<string>",
): CliContractsDocument {
  const raw = parseYamlContent(content, filePath);
  return validateWithZod(CliContractsDocumentSchema, raw, filePath);
}

export async function parseConfigFile(
  filePath: string,
): Promise<CliContractsConfig> {
  const content = await readFileContent(filePath);
  return parseConfigString(content, filePath);
}

export function parseConfigString(
  content: string,
  filePath = "<string>",
): CliContractsConfig {
  const raw = parseYamlContent(content, filePath);
  return validateWithZod(CliContractsConfigSchema, raw, filePath);
}

function validateWithZod<T>(
  schema: ZodType<T>,
  data: unknown,
  filePath: string,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues;
  const lines = issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  ${path}: ${issue.message}`;
  });
  throw new ParseError(
    `Schema validation failed:\n${lines.join("\n")}`,
    filePath,
  );
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (err) {
    throw new ParseError(
      `Cannot read file: ${(err as Error).message}`,
      filePath,
      err as Error,
    );
  }
}

function parseYamlContent(content: string, filePath: string): unknown {
  try {
    return parseYaml(content);
  } catch (err) {
    throw new ParseError(
      `Invalid YAML: ${(err as Error).message}`,
      filePath,
      err as Error,
    );
  }
}
