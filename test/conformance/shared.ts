// What run.ts and the language harnesses share.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeSpec } from "../../src/generators/runtime-spec.js";
import type { NormalizedContext } from "../../src/types.js";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "../..");

export type Variant = "plain" | "usage";
export const VARIANTS: Variant[] = ["plain", "usage"];

export interface Outcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface Vector extends Outcome {
  contract: string;
  variant: Variant;
  argv: string[];
}

export interface ConformanceContract {
  /** File name under contracts/, e.g. `acme.yaml`. */
  file: string;
  /** A name usable in paths and identifiers, e.g. `acme`. */
  name: string;
  ctx: NormalizedContext;
  yaml: string;
  spec: RuntimeSpec;
  argv: string[][];
}

/** The version every conformance program is created with. */
export const PROGRAM_VERSION = "9.8.7";
/** The exit code a handler returns for this command (the others return 0). */
export const FAILING_COMMAND = { id: "users.remove", exitCode: 3 };

/** A handler writes what it receives (keys sorted) as one line after this prefix. */
export const HANDLER_PREFIX = "HANDLER ";
/** onUsageError writes the error as one line after this prefix to stderr, and returns 2. */
export const USAGE_PREFIX = "USAGE ";
/** The prompt an LLM command's handler returns: this prefix and its first argument. */
export const PROMPT_PREFIX = "PROMPT ";

/**
 * Writes the programs of a language under `workDir` and returns the shell
 * script that builds them and runs every invocation, writing
 * `<workDir>/<contract name>.json`.
 */
export type LanguagePreparer = (contracts: ConformanceContract[], workDir: string) => string;

export function resultKey(contract: string, variant: Variant): string {
  return `${contract}:${variant}`;
}

/** The CLI the command wrappers run (test/conformance/argv.sh). */
export const ARGV_SCRIPT = resolve(HERE, "argv.sh");
