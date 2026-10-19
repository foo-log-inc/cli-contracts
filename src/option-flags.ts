import type { Option } from "./types.js";
import { camelCase } from "./policy-runtime.js";

/** How an option is spelled on the command line. */
export interface OptionFlags {
  /** The option as commander registers it: short alias, long flag, value placeholder. */
  flags: string;
  /** The long flag alone. */
  long: string;
  /**
   * `--no-<name>`, for a boolean whose default is true: the spelling that gives
   * it the value false. commander sets the same key from it.
   */
  negated?: string;
  /** The key the parsed value is kept under (`dry-run` → `dryRun`). */
  key: string;
  /**
   * The name starts with `no-`. commander reads such a flag as negating the
   * rest of the name; the option keeps its declared name and key instead.
   */
  noPrefixed: boolean;
}

/** Whether commander collects the option's values into an array (`<name...>`). */
export function optionTakesManyValues(opt: Option): boolean {
  return opt.schema?.type !== "boolean" && opt.repeatable === true;
}

export function optionFlags(opt: Option): OptionFlags {
  const long = `--${opt.name}`;
  const isBoolean = opt.schema?.type === "boolean";
  const valueName = opt.value_name ?? "value";
  const longWithValue = isBoolean
    ? long
    : optionTakesManyValues(opt)
      ? `${long} <${valueName}...>`
      : `${long} <${valueName}>`;
  const alias = opt.aliases?.[0];
  const flags = alias === undefined ? longWithValue : `-${alias}, ${longWithValue}`;
  const key = camelCase(opt.name);
  const noPrefixed = opt.name.startsWith("no-");
  if (isBoolean && opt.schema?.default === true) {
    return { flags, long, negated: `--no-${opt.name}`, key, noPrefixed };
  }
  return { flags, long, key, noPrefixed };
}

/** Every long flag the option is given with: `--<name>`, and `--no-<name>` when it has one. */
export function optionSpellings(opt: Option): string[] {
  const { long, negated } = optionFlags(opt);
  return negated === undefined ? [long] : [long, negated];
}
