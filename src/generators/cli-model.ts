import type {
  NormalizedCommand,
  NormalizedContext,
  Option,
} from "../types.js";
import type { Group } from "../schema.js";
import { optionFlags } from "../option-flags.js";
import {
  BUILTIN_EXTRACT_COMMAND,
  BUILTIN_EXTRACT_OPTIONS,
  commandIsLlmPowered,
  commandOptions,
  contextHasEffects,
  hasBuiltinExtract,
  programGlobalOptions,
} from "../program-options.js";

// The program a contract generates, as the sequence of commander registrations
// that builds it. Every language's generator renders this one sequence: the
// TypeScript generator writes it as commander calls, and the other languages'
// generators replay it on commander to read the resulting command tree
// (see commander-tree.ts).

/** The width every generated program wraps its help at. */
export const HELP_WIDTH = 80;

/** An option as commander registers it. */
export type OptionRegistration =
  | {
      /** `.option(flags, description, default)`; the `--no-<name>` of a default-true boolean has no description. */
      kind: "option";
      flags: string;
      description?: string;
      defaultValue?: string | boolean;
    }
  | {
      /** An option declared under a `no-` name, which keeps that name as its key. */
      kind: "declared";
      flags: string;
      description: string;
      key: string;
      defaultValue?: string | boolean;
    };

export interface ArgumentRegistration {
  name: string;
  required: boolean;
  variadic: boolean;
  description: string;
}

/** A parent command that exists because commands are nested under it. */
export interface GroupStep {
  kind: "group";
  /** The group's path from the program. */
  path: string[];
  description?: string;
}

export interface CommandAction {
  command: NormalizedCommand;
  /** The command takes `--adapter`: with `--show-prompt` it outputs the prompt its handler returns. */
  llm: boolean;
  /** The program has `--introspect`: given, the command outputs its derived policy instead of running. */
  introspect: boolean;
}

/** A contract command. */
export interface CommandStep {
  kind: "command";
  /**
   * How the command is registered:
   * - `chain`: a subcommand of its parent path.
   * - `default`: an empty path; a hidden default subcommand of the program, named by the command id.
   * - `self`: a path other commands are nested under; the group at that path runs it as its
   *   hidden default subcommand of the same name, and lists its options in the group's help.
   */
  form: "chain" | "default" | "self";
  /** The command's path; for `default`, the program's path ([]). */
  path: string[];
  /** For `self`, whether this registration creates the group (no nested command came first). */
  createsGroup: boolean;
  name: string;
  description: string;
  arguments: ArgumentRegistration[];
  options: OptionRegistration[];
  action: CommandAction;
}

/** The built-in extract command. */
export interface ExtractStep {
  kind: "extract";
  name: string;
  description: string;
  arguments: ArgumentRegistration[];
  options: OptionRegistration[];
}

export type ProgramStep = GroupStep | CommandStep | ExtractStep;

export interface ProgramModel {
  executable: string;
  description: string;
  /** Global options, in registration order, without the version and help options commander adds. */
  globalOptions: OptionRegistration[];
  steps: ProgramStep[];
  /** Some registration is a `declared` option. */
  keepsDeclaredNoName: boolean;
  hasEffects: boolean;
  /** The program has the built-in extract command (the last step). */
  hasExtract: boolean;
}

/**
 * The part of each command's contract its policy is derived from
 * (CommandPolicyDefinition in policy-runtime.ts), keyed by command id.
 */
export function buildPolicyDefinitions(ctx: NormalizedContext): Array<[string, Record<string, unknown>]> {
  const definitions: Array<[string, Record<string, unknown>]> = [];
  for (const cs of ctx.command_sets) {
    for (const cmd of cs.commands) {
      const cmdDef: Record<string, unknown> = {};

      if (cmd.effects) {
        cmdDef.effects = cmd.effects;
      }

      // An invocation's options are its command set's global options and the
      // command's own; the policy derives from every one given.
      const optionDefs: Record<string, unknown>[] = [];
      for (const opt of cmd.all_options) {
        const optDef: Record<string, unknown> = {
          name: opt.name,
        };
        if (opt.schema) optDef.schema = opt.schema;
        if (opt.file) optDef.file = opt.file;
        if (opt.effects) optDef.effects = opt.effects;
        if (opt.repeatable) optDef.repeatable = opt.repeatable;
        optionDefs.push(optDef);
      }
      if (optionDefs.length > 0) {
        cmdDef.options = optionDefs;
      }

      const envDef: Record<string, unknown> = {};
      for (const [envName, envVar] of Object.entries(cs.env)) {
        if (envVar.sensitive) {
          envDef[envName] = { sensitive: true };
        }
      }
      if (Object.keys(envDef).length > 0) {
        cmdDef.env = envDef;
      }

      definitions.push([cmd.id, cmdDef]);
    }
  }
  return definitions;
}

function prefixKey(segments: string[]): string {
  return segments.join("\0");
}

/**
 * The registrations of an option. A boolean whose default is true also
 * registers its `--no-<name>` form, so the value false can be given; commander
 * keeps the default of the positive form.
 */
export function optionRegistrations(opt: Option): OptionRegistration[] {
  const { flags, negated, key, noPrefixed } = optionFlags(opt);
  const description = opt.description ?? "";
  const def = opt.schema?.default;
  // commander keeps a boolean default as given and expects a string for any other option.
  const defaultValue = def === undefined ? undefined : typeof def === "boolean" ? def : String(def);
  const registration: OptionRegistration = noPrefixed
    ? { kind: "declared", flags, description, key, defaultValue }
    : { kind: "option", flags, description, defaultValue };
  return negated === undefined ? [registration] : [registration, { kind: "option", flags: negated }];
}

function argumentRegistrations(cmd: NormalizedCommand): ArgumentRegistration[] {
  return cmd.arguments.map((arg) => ({
    name: arg.name,
    required: arg.required === true,
    variadic: arg.variadic === true,
    description: arg.description ?? "",
  }));
}

/**
 * The program generated from a contract. With `withExtract`, the program gets
 * the built-in extract command unless the contract declares one.
 */
export function buildProgramModel(ctx: NormalizedContext, withExtract: boolean): ProgramModel {
  const hasEffects = contextHasEffects(ctx);
  const hasExtract = withExtract && hasBuiltinExtract(ctx);
  // The program takes its name and global options from the first command set.
  const primaryCs = ctx.command_sets[0];

  // commander provides --version and --help itself.
  const globalOptions = programGlobalOptions(ctx, primaryCs)
    .filter((opt) => opt.name !== "version" && opt.name !== "help")
    .flatMap(optionRegistrations);

  const createdPrefixes = new Set<string>();
  const ancestorPrefixes = new Set(
    ctx.command_sets.flatMap((cs) =>
      cs.commands.flatMap((cmd) =>
        cmd.path.slice(0, -1).map((_, i) => prefixKey(cmd.path.slice(0, i + 1))),
      ),
    ),
  );

  const steps: ProgramStep[] = [];

  // Registers the groups a path is nested under, each once.
  const ensureAncestors = (path: string[], groups: Record<string, Group>): void => {
    for (let depth = 1; depth < path.length; depth++) {
      const prefix = path.slice(0, depth);
      const key = prefixKey(prefix);
      if (createdPrefixes.has(key)) continue;
      // A groups entry keyed by the prefix's dotted path describes the group.
      const group = groups[prefix.join(".")];
      steps.push({ kind: "group", path: prefix, description: group?.description ?? group?.summary });
      createdPrefixes.add(key);
    }
  };

  for (const cs of ctx.command_sets) {
    for (const cmd of cs.commands) {
      const path = cmd.path;
      if (path.length > 1) ensureAncestors(path, cs.groups);
      // An empty path means the command is invoked without a subcommand name.
      // commander still needs a name to register it under, so the command id
      // supplies one and the registration is the program's hidden default.
      const form: CommandStep["form"] =
        path.length === 0 ? "default" : ancestorPrefixes.has(prefixKey(path)) ? "self" : "chain";
      const nameSegments = form === "default" ? cmd.id.split(".") : path;
      const name = nameSegments[nameSegments.length - 1];
      if (name === undefined || name === "") {
        throw new Error(`Command ${cmd.id} has no name to register`);
      }
      let createsGroup = false;
      if (form === "self") {
        const key = prefixKey(path);
        createsGroup = !createdPrefixes.has(key);
        createdPrefixes.add(key);
      }
      steps.push({
        kind: "command",
        form,
        path,
        createsGroup,
        name,
        description: cmd.summary,
        arguments: argumentRegistrations(cmd),
        options: commandOptions(cmd).flatMap(optionRegistrations),
        action: { command: cmd, llm: commandIsLlmPowered(cmd), introspect: hasEffects },
      });
    }
  }

  if (hasExtract) {
    steps.push({
      kind: "extract",
      name: BUILTIN_EXTRACT_COMMAND,
      description: "Extract contract specification for this CLI tool.",
      arguments: [
        { name: "commands", required: false, variadic: true, description: "Command IDs to extract. Use dot notation." },
      ],
      options: BUILTIN_EXTRACT_OPTIONS.flatMap(optionRegistrations),
    });
  }

  const allRegistrations = [
    ...globalOptions,
    ...steps.flatMap((step) => (step.kind === "group" ? [] : step.options)),
  ];

  return {
    executable: primaryCs.executable,
    description: primaryCs.summary ?? ctx.info.description ?? "",
    globalOptions,
    steps,
    keepsDeclaredNoName: allRegistrations.some((reg) => reg.kind === "declared"),
    hasEffects,
    hasExtract,
  };
}
