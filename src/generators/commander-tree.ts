import { Command, Option } from "commander";
import {
  HELP_WIDTH,
  type ArgumentRegistration,
  type CommandStep,
  type OptionRegistration,
  type ProgramModel,
} from "./cli-model.js";

// The command tree of the program a contract generates, as commander builds
// it. The program's registrations (cli-model.ts) are replayed on commander, the
// same calls the generated TypeScript program makes, and the tree commander
// holds is read back: its commands, options, initial option values and the help
// it writes. The generators of the other languages emit this tree for their
// runtime, which parses an invocation by commander's rules.

export interface TreeOption {
  flags: string;
  short?: string;
  long?: string;
  /** The name commander keys the option's events by (`--dry-run` → `dry-run`). */
  name: string;
  /** The key its value is kept under (`dry-run` → `dryRun`; `--no-color` → `color`). */
  key: string;
  /** `flag`: sets true. `negate`: sets false. `value`: takes the next argument. */
  kind: "flag" | "negate" | "value";
  /** A value option that collects every value given into an array. */
  variadic: boolean;
  /** The program's `-V, --version`. */
  version: boolean;
}

export type TreeAction =
  | { kind: "command"; commandId: string; llm: boolean; introspect: boolean }
  | { kind: "extract" };

export interface TreeNode {
  name: string;
  options: TreeOption[];
  /** Option values before parsing (the defaults), in the order commander holds them. */
  initialValues: Array<[string, string | boolean]>;
  arguments: Array<{ name: string; required: boolean; variadic: boolean }>;
  commands: TreeNode[];
  hidden: boolean;
  defaultCommand?: string;
  /** The implicit help command's name, when the command has one. */
  helpCommand?: string;
  helpShort?: string;
  helpLong?: string;
  action?: TreeAction;
  /** The help commander writes for the command (ends with a newline). */
  help: string;
  /** The long flags commander suggests from when an option is unknown. */
  optionSuggestions: string[];
  /** The command names commander suggests from when a command is unknown. */
  commandSuggestions: string[];
  /** An option of the command or an ancestor has a digit as its short flag (a negative number is then an option). */
  digitShortOption: boolean;
}

// commander reads a `--no-<x>` flag as negating `--<x>`. An option the
// contract declares under a `no-` name keeps that name: its flag sets it.
// (The generated TypeScript program declares the same class.)
class DeclaredNameOption extends Option {
  readonly key: string;

  constructor(flags: string, description: string, key: string) {
    super(flags, description);
    this.key = key;
    this.negate = false;
  }

  override attributeName(): string {
    return this.key;
  }
}

function addOption(cmd: Command, reg: OptionRegistration): void {
  if (reg.kind === "declared") {
    const opt = new DeclaredNameOption(reg.flags, reg.description, reg.key);
    if (reg.defaultValue !== undefined) opt.default(reg.defaultValue);
    cmd.addOption(opt);
  } else if (reg.description === undefined) {
    cmd.option(reg.flags);
  } else if (reg.defaultValue === undefined) {
    cmd.option(reg.flags, reg.description);
  } else {
    cmd.option(reg.flags, reg.description, reg.defaultValue);
  }
}

function argumentToken(arg: ArgumentRegistration): string {
  const name = arg.variadic ? `${arg.name}...` : arg.name;
  return arg.required ? `<${name}>` : `[${name}]`;
}

function addArguments(cmd: Command, args: ArgumentRegistration[]): void {
  for (const arg of args) cmd.argument(argumentToken(arg), arg.description);
}

function prefixKey(segments: string[]): string {
  return segments.join("\0");
}

const noop = (): void => {};

/** Replays the program's registrations on commander, as the generated TypeScript program does. */
function replay(model: ProgramModel, version: string): { program: Command; actions: Map<Command, TreeAction> } {
  const program = new Command();
  program.configureOutput({
    getOutHelpWidth: () => HELP_WIDTH,
    getErrHelpWidth: () => HELP_WIDTH,
    getOutHasColors: () => false,
    getErrHasColors: () => false,
  });
  program.name(model.executable).version(version, "-V, --version").description(model.description);
  for (const reg of model.globalOptions) addOption(program, reg);

  const actions = new Map<Command, TreeAction>();
  const groups = new Map<string, Command>([[prefixKey([]), program]]);
  const receiver = (path: string[]): Command => {
    const cmd = groups.get(prefixKey(path.length <= 1 ? [] : path.slice(0, -1)));
    if (!cmd) throw new Error(`No command registered at ${path.slice(0, -1).join(" ")}`);
    return cmd;
  };

  const register = (step: CommandStep): Command => {
    if (step.form === "self") {
      const key = prefixKey(step.path);
      let group = groups.get(key);
      if (step.createsGroup || !group) {
        group = receiver(step.path).command(step.name);
        groups.set(key, group);
      }
      group.description(step.description);
      const self = group.command(step.name, { isDefault: true, hidden: true });
      group.configureHelp({ visibleOptions: () => self.createHelp().visibleOptions(self) });
      return self;
    }
    return step.form === "default"
      ? receiver(step.path).command(step.name, { isDefault: true, hidden: true })
      : receiver(step.path).command(step.name);
  };

  for (const step of model.steps) {
    if (step.kind === "group") {
      const group = receiver(step.path).command(step.path[step.path.length - 1]!);
      if (step.description !== undefined) group.description(step.description);
      groups.set(prefixKey(step.path), group);
      continue;
    }
    const cmd = step.kind === "command" ? register(step) : program.command(step.name);
    cmd.description(step.description);
    addArguments(cmd, step.arguments);
    for (const reg of step.options) addOption(cmd, reg);
    cmd.action(noop);
    actions.set(
      cmd,
      step.kind === "command"
        ? {
            kind: "command",
            commandId: step.action.command.id,
            llm: step.action.llm,
            introspect: step.action.introspect,
          }
        : { kind: "extract" },
    );
  }
  return { program, actions };
}

// commander's members the tree is read from. They are not part of its typed API.
interface CommanderInternals {
  _name: string;
  _hidden: boolean;
  _defaultCommandName: string | null;
  _actionHandler: unknown;
  _versionOptionName?: string;
  _enablePositionalOptions: boolean;
  parent: Command | null;
  _getHelpCommand(): Command | null;
  _getHelpOption(): Option | null;
}

function internals(cmd: Command): CommanderInternals {
  return cmd as unknown as CommanderInternals;
}

function readOption(cmd: Command, opt: Option): TreeOption {
  const version = internals(cmd)._versionOptionName !== undefined && opt.attributeName() === internals(cmd)._versionOptionName;
  if (opt.optional) throw new Error(`Option ${opt.flags} takes an optional value, which the generated program does not register`);
  return {
    flags: opt.flags,
    ...(opt.short !== undefined ? { short: opt.short } : {}),
    ...(opt.long !== undefined ? { long: opt.long } : {}),
    name: opt.name(),
    key: opt.attributeName(),
    kind: opt.required ? "value" : opt.negate ? "negate" : "flag",
    variadic: opt.variadic,
    version,
  };
}

function readNode(cmd: Command, actions: Map<Command, TreeAction>): TreeNode {
  const c = internals(cmd);
  const help = cmd.createHelp();
  const helpCommand = c._getHelpCommand();
  const helpOption = c._getHelpOption();

  // The flags commander's unknownOption suggests from: the visible long flags
  // of the command and each ancestor (positional options are not used).
  const optionSuggestions: string[] = [];
  for (let at: Command | null = cmd; at; at = internals(at).parent) {
    optionSuggestions.push(
      ...at.createHelp().visibleOptions(at).filter((o) => o.long).map((o) => o.long!),
    );
    if (internals(at)._enablePositionalOptions) break;
  }

  let digitShortOption = false;
  for (let at: Command | null = cmd; at; at = internals(at).parent) {
    if (at.options.some((o) => o.short !== undefined && /^-\d$/.test(o.short))) digitShortOption = true;
  }

  const initialValues = Object.entries(cmd.opts()).filter(
    (entry): entry is [string, string | boolean] => typeof entry[1] === "string" || typeof entry[1] === "boolean",
  );
  if (initialValues.length !== Object.keys(cmd.opts()).length) {
    throw new Error(`Command ${cmd.name()} has a default that is neither a string nor a boolean`);
  }

  const action = actions.get(cmd);
  return {
    name: c._name,
    options: cmd.options.map((opt) => readOption(cmd, opt)),
    initialValues,
    arguments: cmd.registeredArguments.map((arg) => ({
      name: arg.name(),
      required: arg.required,
      variadic: arg.variadic,
    })),
    commands: cmd.commands.map((sub) => readNode(sub, actions)),
    hidden: c._hidden,
    ...(c._defaultCommandName ? { defaultCommand: c._defaultCommandName } : {}),
    ...(helpCommand ? { helpCommand: helpCommand.name() } : {}),
    ...(helpOption?.short !== undefined ? { helpShort: helpOption.short } : {}),
    ...(helpOption?.long !== undefined ? { helpLong: helpOption.long } : {}),
    ...(action ? { action } : {}),
    help: cmd.helpInformation(),
    optionSuggestions,
    commandSuggestions: help.visibleCommands(cmd).flatMap((sub) => (sub.alias() ? [sub.name(), sub.alias()] : [sub.name()])),
    digitShortOption,
  };
}

/**
 * The command tree commander builds for the program. The version string is
 * not part of the tree (the program is given it when it is created); the
 * placeholder registers the version option.
 */
export function buildCommandTree(model: ProgramModel): TreeNode {
  const { program, actions } = replay(model, "0.0.0");
  return readNode(program, actions);
}
