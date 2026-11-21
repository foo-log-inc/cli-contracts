import { parse as parseYaml } from "yaml";
import type { NormalizedCommand, NormalizedContext } from "../types.js";
import { optionFlags, optionTakesManyValues } from "../option-flags.js";
import { commandIsLlmPowered, commandOptions } from "../program-options.js";
import { buildPolicyDefinitions, buildProgramModel } from "./cli-model.js";
import { buildCommandTree, type TreeNode } from "./commander-tree.js";

// What the generators of the languages other than TypeScript emit for their
// runtime: the program's command tree (commander-tree.ts), the contract's
// commands as the handlers see them, the policy definitions and the output of
// the built-in extract command. Everything the TypeScript program computes from
// the contract alone is computed here, once, so a runtime only parses the
// invocation and fills in what depends on it.

/** The value a handler receives for an option. */
export type HandlerOptionType = "boolean" | "string" | "strings";

export interface SpecCommand {
  id: string;
  fullId: string;
  arguments: Array<{ name: string; required: boolean; variadic: boolean }>;
  /** The command's options as the program passes them to its handler (`opts()`). */
  options: Array<{ name: string; key: string; type: HandlerOptionType }>;
  llm: boolean;
  exitCodes: number[];
}

/**
 * The output of the built-in extract command, computed from the embedded
 * contract. `EXTRACTED_AT` stands where the time of the invocation goes.
 */
export interface ExtractSpec {
  /** `--all`, YAML, with and without `--include-meta`. */
  yamlWithMeta: string;
  yamlWithoutMeta: string;
  /** `--all --format json`, with and without `--include-meta`. */
  jsonWithMeta: string;
  jsonWithoutMeta: string;
  /** Command IDs given: the document filtered to the matching commands, as JSON. */
  filter: ExtractFilterSpec;
}

/**
 * `JSON.stringify(filtered, null, 2)` in pieces. The output is
 * `head + commandSets + tail`, where `commandSets` is `{}` when no command
 * matches, else `{\n` + each matching set joined by `,\n` + `\n  }`; a set is
 * `    "<id>": {\n` + its entries joined by `,\n` + `\n    }`, its `commands`
 * entry being `      "commands": {\n` + each matching command joined by
 * `,\n` + `\n      }`.
 */
export interface ExtractFilterSpec {
  head: string;
  tail: string;
  sets: Array<{
    id: string;
    /** The set's JSON key, `    "<id>": `. */
    key: string;
    /** The set's entries before and after `commands`, each a full line group without the separator. */
    before: string[];
    after: string[];
    commands: Array<{ id: string; text: string }>;
  }>;
}

export interface RuntimeSpec {
  executable: string;
  tree: TreeNode;
  commands: SpecCommand[];
  /** Present when the contract declares effects (the program has `--introspect`). */
  policyDefinitions?: Array<[string, unknown]>;
  /** Present when the program has the built-in extract command. */
  extract?: ExtractSpec;
  /** The contract, as embedded for extract (YAML source and its JSON). */
  contract?: { yaml: string; json: string };
}

/** Stands for the time of the invocation in the extract output. */
export const EXTRACTED_AT = "\u0000cli-contracts:extractedAt\u0000";
/** `EXTRACTED_AT` as it appears inside a JSON string. */
export const EXTRACTED_AT_JSON = JSON.stringify(EXTRACTED_AT).slice(1, -1);

function handlerOptionType(opt: import("../types.js").Option): HandlerOptionType {
  return opt.schema?.type === "boolean" ? "boolean" : optionTakesManyValues(opt) ? "strings" : "string";
}

function specCommand(cmd: NormalizedCommand): SpecCommand {
  return {
    id: cmd.id,
    fullId: cmd.full_id,
    arguments: cmd.arguments.map((arg) => ({
      name: arg.name,
      required: arg.required === true,
      variadic: arg.variadic === true,
    })),
    options: commandOptions(cmd).map((opt) => ({
      name: opt.name,
      key: optionFlags(opt).key,
      type: handlerOptionType(opt),
    })),
    llm: commandIsLlmPowered(cmd),
    exitCodes: cmd.exits.map((e) => e.exit_code),
  };
}

/** `JSON.stringify(value, null, 2)` written at a nesting depth. */
function jsonAt(value: unknown, depth: number): string {
  return JSON.stringify(value, null, 2).replace(/\n/g, `\n${"  ".repeat(depth)}`);
}

/** An object entry at a depth: indent, key and value. */
function entryAt(key: string, value: unknown, depth: number): string {
  return `${"  ".repeat(depth)}${JSON.stringify(key)}: ${jsonAt(value, depth)}`;
}

// The extract output, computed as the TypeScript program's extract action
// computes it (typescript.ts generateBuiltinExtractCommand), with EXTRACTED_AT
// for the time.
function buildExtract(ctx: NormalizedContext, contractYaml: string): ExtractSpec {
  const doc = parseYaml(contractYaml) as Record<string, unknown>;
  const executable = ctx.command_sets[0].executable;
  const allFullIds = ctx.command_sets.flatMap((cs) => cs.commands.map((c) => c.full_id));
  const specVersion = doc.cli_contracts ?? "0.1.0";

  const yamlHead = [`# ${executable} extract`, "# source: embedded", "# type: cli-contracts/command-extract"];
  const yamlMeta = [
    "---",
    "source: embedded",
    "type: cli-contracts/command-extract",
    "extractedAt: " + EXTRACTED_AT,
    "spec_version: " + String(specVersion),
    "commands:",
    ...allFullIds.map((id) => "  - " + id),
  ];
  const yamlBody = ["---", contractYaml];

  const withMeta: Record<string, unknown> = {
    _meta: {
      source: "embedded",
      type: "cli-contracts/extract",
      extractedAt: EXTRACTED_AT,
      specVersion,
      commands: allFullIds,
    },
  };
  Object.assign(withMeta, doc);
  const withoutMeta: Record<string, unknown> = {};
  Object.assign(withoutMeta, doc);

  // The filtered document: its top-level entries, with the command sets in between.
  const headEntries: string[] = [];
  if (doc.cli_contracts !== undefined) headEntries.push(entryAt("cli_contracts", doc.cli_contracts, 1));
  if (doc.info !== undefined) headEntries.push(entryAt("info", doc.info, 1));
  const sets: ExtractFilterSpec["sets"] = [];
  for (const [setId, cs] of Object.entries((doc.command_sets ?? {}) as Record<string, unknown>)) {
    const set = cs as Record<string, unknown>;
    const cmds = set.commands as Record<string, unknown> | undefined;
    if (!cmds) continue;
    const before: string[] = [];
    const after: string[] = [];
    let seenCommands = false;
    for (const [key, value] of Object.entries(set)) {
      if (key === "commands") {
        seenCommands = true;
        continue;
      }
      if (value === undefined) continue;
      (seenCommands ? after : before).push(entryAt(key, value, 3));
    }
    sets.push({
      id: setId,
      key: `    ${JSON.stringify(setId)}: `,
      before,
      after,
      commands: Object.entries(cmds).map(([cmdId, def]) => ({ id: cmdId, text: entryAt(cmdId, def, 4) })),
    });
  }

  return {
    yamlWithMeta: [...yamlHead, ...yamlMeta, ...yamlBody].join("\n") + "\n",
    yamlWithoutMeta: [...yamlHead, ...yamlBody].join("\n") + "\n",
    jsonWithMeta: JSON.stringify(withMeta, null, 2) + "\n",
    jsonWithoutMeta: JSON.stringify(withoutMeta, null, 2) + "\n",
    filter: {
      head: "{\n" + [...headEntries, '  "command_sets": '].join(",\n"),
      tail: (doc.components ? ",\n" + entryAt("components", doc.components, 1) : "") + "\n}\n",
      sets,
    },
  };
}

/**
 * The runtime spec of the program a contract generates. With `contractYaml`,
 * the program embeds the contract and gets the built-in extract command unless
 * the contract declares one.
 */
export function buildRuntimeSpec(ctx: NormalizedContext, contractYaml?: string): RuntimeSpec {
  const model = buildProgramModel(ctx, contractYaml !== undefined);
  const commands = ctx.command_sets.flatMap((cs) => cs.commands.map(specCommand));
  return {
    executable: model.executable,
    tree: buildCommandTree(model),
    commands,
    ...(model.hasEffects ? { policyDefinitions: buildPolicyDefinitions(ctx) } : {}),
    ...(model.hasExtract && contractYaml !== undefined ? { extract: buildExtract(ctx, contractYaml) } : {}),
    ...(contractYaml !== undefined
      ? { contract: { yaml: contractYaml, json: JSON.stringify(parseYaml(contractYaml), null, 2) } }
      : {}),
  };
}
