import type { Option } from "../types.js";

/** How an option is spelled on the command line. */
export interface OptionFlags {
  /** The option as commander registers it: short alias, long flag, value placeholder. */
  flags: string;
  /** The long flag alone. */
  long: string;
  /**
   * `--no-<name>`, for a boolean whose default is true: the spelling that gives
   * it the value false. commander sets the same key as `long` from it.
   */
  negated?: string;
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
  if (isBoolean && opt.schema?.default === true) {
    return { flags, long, negated: `--no-${opt.name}` };
  }
  return { flags, long };
}
