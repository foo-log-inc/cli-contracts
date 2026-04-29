import { writeFile, access, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { buildDefaultConfig } from "../config.js";

export interface InitOptions {
  name?: string;
  multiCommandSet?: boolean;
  output?: string;
  withConfig?: boolean;
}

export interface InitResult {
  contractFile: string;
  configFile?: string;
}

export async function runInit(options: InitOptions): Promise<InitResult> {
  const outputDir = resolve(options.output ?? ".");
  const contractPath = join(outputDir, "cli-contract.yaml");
  const configPath = join(outputDir, "cli-contracts.config.yaml");

  await mkdir(outputDir, { recursive: true });

  if (await fileExists(contractPath)) {
    throw new FileExistsError(contractPath);
  }

  const name = options.name ?? "my-cli";
  const contractContent = buildContractTemplate(name, options.multiCommandSet);
  await writeFile(contractPath, contractContent, "utf-8");

  const result: InitResult = { contractFile: contractPath };

  if (options.withConfig) {
    if (await fileExists(configPath)) {
      throw new FileExistsError(configPath);
    }
    await writeFile(configPath, buildDefaultConfig(), "utf-8");
    result.configFile = configPath;
  }

  return result;
}

export class FileExistsError extends Error {
  constructor(public readonly filePath: string) {
    super(`File already exists: ${filePath}`);
    this.name = "FileExistsError";
  }
}

function buildContractTemplate(
  name: string,
  multiCommandSet?: boolean,
): string {
  const doc: Record<string, unknown> = {
    cliContracts: "0.1.0",
    info: {
      title: `${name} CLI Contracts`,
      version: "0.1.0",
      description: `Contract definitions for ${name}.`,
    },
    commandSets: {
      [name]: {
        summary: `${name} command line tool.`,
        commands: {
          hello: {
            summary: "Say hello.",
            arguments: [
              {
                name: "name",
                required: false,
                description: "Name to greet.",
                schema: { type: "string" },
              },
            ],
            exits: {
              "0": {
                description: "Success.",
                stdout: {
                  format: "text",
                },
              },
            },
          },
        },
      },
    },
  };

  if (multiCommandSet) {
    (doc.commandSets as Record<string, unknown>)[`${name}-admin`] = {
      summary: `${name} admin CLI.`,
      commands: {
        status: {
          summary: "Show system status.",
          exits: {
            "0": {
              description: "Success.",
              stdout: { format: "json" },
            },
          },
        },
      },
    };
  }

  return stringifyYaml(doc, { lineWidth: 120 });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
