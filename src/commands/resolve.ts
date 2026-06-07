import { resolve } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { resolveContractFile } from "../resolver/resolve.js";

export interface ResolveCommandOptions {
  file?: string;
  format?: "yaml" | "json";
}

export interface ResolveCommandResult {
  document: unknown;
  source_path: string;
  base_paths: string[];
  output: string;
}

export async function runResolve(
  contractFile: string,
  options: ResolveCommandOptions = {},
): Promise<ResolveCommandResult> {
  const filePath = resolve(contractFile);
  const result = await resolveContractFile(filePath);
  const format = options.format ?? "yaml";

  const output =
    format === "json"
      ? JSON.stringify(result.document, null, 2) + "\n"
      : yamlStringify(result.document, { lineWidth: 120 });

  return {
    document: result.document,
    source_path: result.sourcePath,
    base_paths: result.basePaths,
    output,
  };
}
