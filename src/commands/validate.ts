import { resolve, dirname } from "node:path";
import { parseContractFile } from "../parser.js";
import { validateContract } from "../validator.js";
import type { ValidateResult } from "../types.js";

export interface ValidateOptions {
  file?: string[];
  strict?: boolean;
  resolveRefs?: boolean;
}

export async function runValidate(
  contractFiles: string[],
  options: ValidateOptions = {},
): Promise<ValidateResult> {
  const allErrors: ValidateResult["errors"] = [];
  const allWarnings: ValidateResult["warnings"] = [];

  for (const file of contractFiles) {
    const filePath = resolve(file);
    const doc = await parseContractFile(filePath);
    const result = validateContract(doc, { basePath: dirname(filePath) });
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  if (options.strict) {
    allErrors.push(...allWarnings.map((w) => ({ ...w, severity: "error" as const })));
    allWarnings.length = 0;
  }

  return {
    valid: allErrors.length === 0,
    error_count: allErrors.length,
    warning_count: allWarnings.length,
    errors: allErrors,
    warnings: allWarnings,
  };
}
