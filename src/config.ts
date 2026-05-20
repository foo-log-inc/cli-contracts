import { access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { parseConfigFile, parseConfigString } from "./parser.js";
import type { CliContractsConfig } from "./types.js";

const DEFAULT_CONFIG_FILENAME = "cli-contracts.config.yaml";
const DEFAULT_CONTRACT_FILES = ["cli-contract.yaml"];

export async function loadConfig(
  configPath?: string,
): Promise<{ config: CliContractsConfig; configDir: string } | null> {
  const isExplicit = configPath !== undefined
    && configPath !== DEFAULT_CONFIG_FILENAME;
  const resolved = resolve(configPath ?? DEFAULT_CONFIG_FILENAME);

  try {
    await access(resolved);
  } catch {
    if (isExplicit) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    return null;
  }

  const config = await parseConfigFile(resolved);
  return { config, configDir: dirname(resolved) };
}

export function getContractFiles(config?: CliContractsConfig): string[] {
  return config?.input?.files ?? DEFAULT_CONTRACT_FILES;
}

export function getDefaultProfile(
  config?: CliContractsConfig,
): string | undefined {
  if (!config?.execution_profiles) return undefined;
  for (const [name, profile] of Object.entries(config.execution_profiles)) {
    if (profile.default) return name;
  }
  return Object.keys(config.execution_profiles)[0];
}

export function buildDefaultConfig(): string {
  return `version: 0.1.0

input:
  files:
    - cli-contract.yaml

generators:
  markdown:
    enabled: true
    output: ./docs/cli-reference.md
    templates: builtin:markdown

  typescript:
    enabled: true
    output: ./generated/typescript
    templates: builtin:typescript
    options:
      emitTypes: true
      emitValidators: true
`;
}
