import { dirname, resolve, relative } from "node:path";
import { stringify as yamlStringify } from "yaml";
import { parseContractFile } from "../parser.js";
import { resolveRefs } from "../ref-resolver.js";
import type {
  CliContractsDocument,
  CommandSet,
  Command,
  Components,
  JsonSchema,
} from "../types.js";
import type { OutputFormat } from "../output.js";
import { formatOutput } from "../output.js";

export interface ExtractOptions {
  commandSet?: string;
  format?: OutputFormat;
}

export interface ExtractResult {
  output: string;
  commandCount: number;
  commandIds: string[];
}

export async function runExtract(
  contractFiles: string[],
  commandIds: string[],
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  if (contractFiles.length === 0) {
    throw new Error("No contract files specified");
  }

  const filePath = resolve(contractFiles[0]);
  let doc = await parseContractFile(filePath);
  doc = resolveRefs(doc, { basePath: dirname(filePath) });

  const matched = findCommands(doc, commandIds, options.commandSet);
  const subset = buildSubset(doc, matched);

  const format = options.format ?? "yaml";
  const meta = buildMeta(filePath, commandIds, matched);
  const output = renderWithMeta(meta, subset, format);

  return {
    output,
    commandCount: matched.length,
    commandIds: matched.map((m) => m.fullId),
  };
}

interface MatchedCommand {
  setId: string;
  cmdId: string;
  fullId: string;
  command: Command;
  commandSet: CommandSet;
}

function findCommands(
  doc: CliContractsDocument,
  commandIds: string[],
  commandSetFilter?: string,
): MatchedCommand[] {
  const results: MatchedCommand[] = [];

  for (const [setId, cs] of Object.entries(doc.commandSets)) {
    if (commandSetFilter && setId !== commandSetFilter) continue;

    for (const [cmdId, cmd] of Object.entries(cs.commands)) {
      const fullId = `${setId}.${cmdId}`;
      const matches =
        commandIds.length === 0 ||
        commandIds.some(
          (id) => id === cmdId || id === fullId || cmdId.startsWith(id + "."),
        );
      if (matches) {
        results.push({ setId, cmdId, fullId, command: cmd, commandSet: cs });
      }
    }
  }

  return results;
}

function buildSubset(
  doc: CliContractsDocument,
  matched: MatchedCommand[],
): Record<string, unknown> {
  const commandSetMap: Record<string, Record<string, unknown>> = {};

  for (const m of matched) {
    if (!commandSetMap[m.setId]) {
      commandSetMap[m.setId] = {};
    }
    commandSetMap[m.setId][m.cmdId] = m.command;
  }

  const subsetCommandSets: Record<string, unknown> = {};
  for (const [setId, commands] of Object.entries(commandSetMap)) {
    const original = matched.find((m) => m.setId === setId)!.commandSet;
    const cs: Record<string, unknown> = {
      commands,
    };
    if (original.executable) cs.executable = original.executable;
    if (original.summary) cs.summary = original.summary;
    if (original.globalOptions && original.globalOptions.length > 0) {
      cs.globalOptions = original.globalOptions;
    }
    subsetCommandSets[setId] = cs;
  }

  const subset: Record<string, unknown> = {
    cliContracts: doc.cliContracts,
    info: doc.info,
    commandSets: subsetCommandSets,
  };

  const usedSchemas = collectUsedSchemas(matched, doc.components);
  if (usedSchemas && Object.keys(usedSchemas).length > 0) {
    subset.components = { schemas: usedSchemas };
  }

  return subset;
}

function collectUsedSchemas(
  matched: MatchedCommand[],
  components?: Components,
): Record<string, JsonSchema> | undefined {
  if (!components?.schemas) return undefined;

  const allSchemas = components.schemas;
  const used = new Set<string>();

  for (const m of matched) {
    collectRefsFromValue(m.command, used);
  }

  // Since $ref is resolved, inline schemas may reference component names
  // Include all schemas referenced from matched commands
  const result: Record<string, JsonSchema> = {};
  for (const name of used) {
    if (allSchemas[name]) {
      result[name] = allSchemas[name];
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function collectRefsFromValue(value: unknown, refs: Set<string>): void {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) collectRefsFromValue(item, refs);
    return;
  }

  const obj = value as Record<string, unknown>;
  if (typeof obj.$ref === "string") {
    const ref = obj.$ref as string;
    const match = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match) refs.add(match[1]);
  }

  for (const v of Object.values(obj)) {
    collectRefsFromValue(v, refs);
  }
}

interface ExtractMeta {
  source: string;
  type: string;
  extractedAt: string;
  specVersion: string;
  commands: string[];
}

function buildMeta(
  filePath: string,
  requestedIds: string[],
  matched: MatchedCommand[],
): ExtractMeta {
  return {
    source: relative(process.cwd(), filePath) || filePath,
    type: "cli-contracts/command-extract",
    extractedAt: new Date().toISOString(),
    specVersion: "0.1.0",
    commands: matched.map((m) => m.fullId),
  };
}

function renderWithMeta(
  meta: ExtractMeta,
  subset: Record<string, unknown>,
  format: OutputFormat,
): string {
  if (format === "json") {
    return JSON.stringify({ _meta: meta, ...subset }, null, 2) + "\n";
  }

  // YAML: multi-document format
  //   Document 1: metadata
  //   Document 2: contract subset
  const metaYaml = yamlStringify(meta, { lineWidth: 120 });
  const subsetYaml = yamlStringify(subset, { lineWidth: 120 });

  const lines: string[] = [];
  lines.push("# cli-contracts extract");
  lines.push(`# source: ${meta.source}`);
  lines.push(`# type: ${meta.type}`);
  lines.push("---");
  lines.push(metaYaml.trimEnd());
  lines.push("---");
  lines.push(subsetYaml.trimEnd());
  lines.push("");

  return lines.join("\n");
}
