import { resolve, dirname } from "node:path";
import { parseContractFile } from "../parser.js";
import { validateContract } from "../validator.js";
import { resolveRefs } from "../ref-resolver.js";
import { normalizeContract } from "../normalizer.js";
import { runGenerators } from "../generators/index.js";
import type {
  CliContractsConfig,
  GenerateResult,
  ValidateResult,
} from "../types.js";

export interface GenerateOptions {
  file?: string[];
  generators?: string[];
  output?: string;
  dryRun?: boolean;
  clean?: boolean;
  config?: CliContractsConfig;
}

export async function runGenerate(
  contractFiles: string[],
  options: GenerateOptions = {},
): Promise<GenerateResult | { validationFailed: true; result: ValidateResult }> {
  const config = options.config;
  const generatorConfigs = config?.generators ?? {};

  if (Object.keys(generatorConfigs).length === 0) {
    return { generators: [] };
  }

  for (const file of contractFiles) {
    const filePath = resolve(file);
    let doc = await parseContractFile(filePath);
    const validation = validateContract(doc, { basePath: dirname(filePath) });

    if (!validation.valid) {
      return { validationFailed: true, result: validation };
    }

    doc = resolveRefs(doc, { basePath: dirname(filePath) });
    const ctx = normalizeContract(doc);

    return runGenerators(
      ctx,
      generatorConfigs,
      options.generators,
      options.output,
      options.dryRun,
      options.clean,
    );
  }

  return { generators: [] };
}
