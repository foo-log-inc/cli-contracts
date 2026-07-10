import type {
  CliContractsDocument,
  NormalizedContext,
  NormalizedCommandSet,
  NormalizedCommand,
  NormalizedExit,
  Option,
  Argument,
} from "./types.js";
import { ArgumentSchema, OptionSchema } from "./schema.js";

// Argument/Option schemas use `.passthrough()` so the validator can warn on
// unknown-key typos (#83). To keep normalized output — and therefore all
// generated artifacts — free of those passthrough'd keys, strip each object
// down to its known schema fields here (identical to the pre-passthrough
// behavior, where a plain z.object() dropped unknown keys at parse time).
const KNOWN_ARGUMENT_KEYS = new Set(Object.keys(ArgumentSchema.shape));
const KNOWN_OPTION_KEYS = new Set(Object.keys(OptionSchema.shape));

function pickKnown<T extends Record<string, unknown>>(
  obj: T,
  knownKeys: Set<string>,
): T {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (knownKeys.has(key)) out[key] = val;
  }
  return out as T;
}

function stripArgument(arg: Argument): Argument {
  return pickKnown(arg as Record<string, unknown>, KNOWN_ARGUMENT_KEYS) as Argument;
}

function stripOption(opt: Option): Option {
  return pickKnown(opt as Record<string, unknown>, KNOWN_OPTION_KEYS) as Option;
}

/**
 * Converts a parsed contract document into a normalized generator context.
 * Maps are converted to arrays for template iteration. Derived fields
 * (path, invocation, full_id) are computed.
 */
export function normalizeContract(
  doc: CliContractsDocument,
): NormalizedContext {
  const command_sets: NormalizedCommandSet[] = [];

  for (const [setId, cs] of Object.entries(doc.command_sets)) {
    const executable = cs.executable ?? setId;
    const global_options: Option[] = (cs.global_options ?? []).map(stripOption);

    const commands: NormalizedCommand[] = [];
    for (const [cmdId, cmd] of Object.entries(cs.commands)) {
      const pathSegments = cmd.path ?? cmdId.split(".");
      const invocation = [executable, ...pathSegments].join(" ");

      const exits: NormalizedExit[] = [];
      for (const [code, exit] of Object.entries(cmd.exits)) {
        exits.push({
          exit_code: Number(code),
          description: exit.description,
          stdout: exit.stdout,
          stderr: exit.stderr,
          files: exit.files,
        });
      }
      exits.sort((a, b) => a.exit_code - b.exit_code);

      const extensions: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(cmd)) {
        if (key.startsWith("x-")) {
          extensions[key] = val;
        }
      }

      commands.push({
        id: cmdId,
        full_id: `${setId}.${cmdId}`,
        path: pathSegments,
        invocation,
        summary: cmd.summary,
        description: cmd.description,
        usage: cmd.usage,
        arguments: (cmd.arguments ?? []).map(stripArgument),
        options: (cmd.options ?? []).map(stripOption),
        all_options: [
          ...global_options,
          ...(cmd.options ?? []).map(stripOption),
        ],
        effects: cmd.effects,
        constraints: cmd.constraints,
        streams: cmd.streams,
        signals: cmd.signals,
        exits,
        examples: cmd.examples,
        deprecated: cmd.deprecated,
        extensions,
      });
    }

    const setExtensions: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(cs)) {
      if (key.startsWith("x-")) {
        setExtensions[key] = val;
      }
    }

    command_sets.push({
      id: setId,
      executable,
      summary: cs.summary,
      description: cs.description,
      global_options,
      env: cs.env ?? {},
      commands,
      groups: cs.groups ?? {},
      extensions: setExtensions,
    });
  }

  return {
    spec_version: doc.cli_contracts,
    info: doc.info,
    command_sets,
    components: doc.components ?? {},
  };
}
