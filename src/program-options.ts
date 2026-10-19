import type {
  NormalizedCommand,
  NormalizedCommandSet,
  NormalizedContext,
  Option,
} from "./types.js";

// The options a program generated from a contract accepts: the contract's
// own, and the ones the TypeScript generator adds to them.

/** Added to the program when the contract declares effects. */
export const INTROSPECT_OPTION: Option = {
  name: "introspect",
  description: "Output derived policy as JSON without executing the command",
  schema: { type: "boolean" },
};

/** Added to an LLM-powered command that does not declare it. */
export const SHOW_PROMPT_OPTION: Option = {
  name: "show-prompt",
  description: "Output the constructed prompt without calling the LLM API.",
  schema: { type: "boolean", default: false },
};

/** The command added to a program whose contract declares no command of that id. */
export const BUILTIN_EXTRACT_COMMAND = "extract";

export const BUILTIN_EXTRACT_OPTIONS: Option[] = [
  { name: "all", aliases: ["a"], description: "Extract all commands.", schema: { type: "boolean", default: false } },
  { name: "include-meta", description: "Include extraction metadata.", schema: { type: "boolean", default: true } },
  { name: "format", aliases: ["F"], value_name: "format", description: "Output format (yaml or json).", schema: { type: "string", default: "yaml" } },
];

export function contextHasEffects(ctx: NormalizedContext): boolean {
  return ctx.command_sets.some((cs) =>
    cs.commands.some((cmd) => Boolean(cmd.effects) || cmd.options.some((opt) => Boolean(opt.effects))),
  );
}

/** A command that takes `--adapter` calls an LLM. */
export function commandIsLlmPowered(cmd: NormalizedCommand): boolean {
  return cmd.options.some((o) => o.name === "adapter");
}

/** The program gets the built-in extract command unless the contract declares one. */
export function hasBuiltinExtract(ctx: NormalizedContext): boolean {
  return !ctx.command_sets.some((cs) => cs.commands.some((c) => c.id === BUILTIN_EXTRACT_COMMAND));
}

/** The global options of the program generated for a command set. */
export function programGlobalOptions(ctx: NormalizedContext, cs: NormalizedCommandSet): Option[] {
  return contextHasEffects(ctx) ? [...cs.global_options, INTROSPECT_OPTION] : cs.global_options;
}

/** A command's options in the generated program. */
export function commandOptions(cmd: NormalizedCommand): Option[] {
  const addsShowPrompt =
    commandIsLlmPowered(cmd) && !cmd.options.some((o) => o.name === SHOW_PROMPT_OPTION.name);
  return addsShowPrompt ? [...cmd.options, SHOW_PROMPT_OPTION] : cmd.options;
}

/**
 * The options the program generated from the contract, with the contract
 * embedded as `cli-contracts generate` does, accepts for a command: its
 * command set's global options and the command's own. Undefined when the
 * program has no such command.
 */
export function acceptedOptions(
  ctx: NormalizedContext,
  commandSetId: string,
  commandId: string,
): Option[] | undefined {
  const cs = ctx.command_sets.find((c) => c.id === commandSetId);
  if (!cs) return undefined;
  const cmd = cs.commands.find((c) => c.id === commandId);
  if (cmd) return [...programGlobalOptions(ctx, cs), ...commandOptions(cmd)];
  if (commandId === BUILTIN_EXTRACT_COMMAND && hasBuiltinExtract(ctx)) {
    return [...programGlobalOptions(ctx, cs), ...BUILTIN_EXTRACT_OPTIONS];
  }
  return undefined;
}
