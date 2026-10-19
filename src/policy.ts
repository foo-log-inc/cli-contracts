// The policy derivation is implemented once, in policy-runtime.ts, which the
// TypeScript generator also copies into generated code. This module types it
// with the contract schema.
import type { Command, Option, Effects, EnvVar } from "./schema.js";
import * as runtime from "./policy-runtime.js";
import type {
  DerivedPolicy,
  IntrospectionResult,
  OptionInput,
} from "./policy-runtime.js";

export type {
  DerivedReadEffect,
  DerivedWriteEffect,
  DerivedNetworkEffect,
  DerivedPolicy,
  IntrospectionResult,
  OptionInput,
} from "./policy-runtime.js";

export interface PolicyDerivationInput {
  command_id: string;
  command_effects?: Effects;
  options: Record<
    string,
    OptionInput & { definition: Option }
  >;
  env?: Record<string, EnvVar>;
}

export function isOptionActive(
  definition: Option,
  value: unknown,
  specified: boolean,
): boolean {
  return runtime.isOptionActive(definition, value, specified);
}

export function derivePolicy(input: PolicyDerivationInput): DerivedPolicy {
  return runtime.derivePolicy(input);
}

/**
 * Builds the introspection result for a command from the option values
 * commander parsed for it, keyed as commander keys them (`dry-run` → `dryRun`).
 * Generated programs reach the same derivation through deriveCommandPolicy.
 */
export function buildIntrospection(
  commandId: string,
  command: Command,
  optionValues: Record<string, unknown>,
  env?: Record<string, EnvVar>,
): IntrospectionResult {
  return runtime.introspectCommand(
    commandId,
    { effects: command.effects, options: command.options, env },
    optionValues,
  );
}
