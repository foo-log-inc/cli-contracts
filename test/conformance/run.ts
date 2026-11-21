// Language conformance of the generated programs (TEST-DESIGN T1).
//
//   tsx test/conformance/run.ts record <file>   run the TypeScript programs and write the vectors to <file>
//   tsx test/conformance/run.ts check <lang>    run the <lang> programs and compare them with vectors.json
//                                              (<lang>: typescript, go, rust, python, php)
//
// Each contract under contracts/ generates a program in every language. Its
// handlers write what they receive as one `HANDLER <json>` line; created with
// `onUsageError`, the program writes `USAGE <json>` for an argument error and
// exits 2. Every invocation in cases.ts runs on both programs, and its exit
// code, stdout and stderr are compared byte for byte with the vector the
// TypeScript program (commander) recorded.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseContractFile } from "../../src/parser.js";
import { resolveRefs } from "../../src/ref-resolver.js";
import { normalizeContract } from "../../src/normalizer.js";
import { buildRuntimeSpec, type RuntimeSpec } from "../../src/generators/runtime-spec.js";
import type { NormalizedContext } from "../../src/types.js";
import { CASES } from "./cases.js";
import { runTypeScript } from "./harness/typescript.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const OUT = join(HERE, "out");
const VECTORS = join(HERE, "vectors.json");

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

/** Runs every invocation of a contract on both programs, in `cases` order. */
export type LanguageRunner = (contracts: ConformanceContract[], workDir: string) => Promise<Map<string, Outcome[]>>;

export function resultKey(contract: string, variant: Variant): string {
  return `${contract}:${variant}`;
}

const ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;

/** The time extract writes, as `new Date().toISOString()` formats it, stands as `<TIME>`. */
function normalize(text: string): string {
  return text.replace(ISO_TIME, "<TIME>");
}

async function loadContracts(): Promise<ConformanceContract[]> {
  const contracts: ConformanceContract[] = [];
  for (const { contract, argv } of CASES) {
    const path = resolve(HERE, "contracts", contract);
    const doc = resolveRefs(await parseContractFile(path), { basePath: dirname(path) });
    const ctx = normalizeContract(doc);
    const yaml = readFileSync(path, "utf-8");
    contracts.push({
      file: contract,
      name: contract.replace(/\.yaml$/, ""),
      ctx,
      yaml,
      spec: buildRuntimeSpec(ctx, yaml),
      argv,
    });
  }
  return contracts;
}

async function runnerFor(lang: string): Promise<LanguageRunner> {
  switch (lang) {
    case "typescript":
      return runTypeScript;
    case "go":
      return (await import("./harness/go.js")).runGo;
    case "rust":
      return (await import("./harness/rust.js")).runRust;
    case "python":
      return (await import("./harness/python.js")).runPython;
    case "php":
      return (await import("./harness/php.js")).runPhp;
    default:
      throw new Error(`Unknown language: ${lang}`);
  }
}

async function run(lang: string, contracts: ConformanceContract[]): Promise<Vector[]> {
  const workDir = join(OUT, lang);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const results = await (await runnerFor(lang))(contracts, workDir);
  const vectors: Vector[] = [];
  for (const c of contracts) {
    for (const variant of VARIANTS) {
      const outcomes = results.get(resultKey(c.file, variant));
      if (!outcomes || outcomes.length !== c.argv.length) {
        throw new Error(
          `${lang}: ${c.file} (${variant}) ran ${outcomes?.length ?? 0} of ${c.argv.length} invocations`,
        );
      }
      c.argv.forEach((argv, i) => {
        const o = outcomes[i]!;
        vectors.push({
          contract: c.file,
          variant,
          argv,
          exitCode: o.exitCode,
          stdout: normalize(o.stdout),
          stderr: normalize(o.stderr),
        });
      });
    }
  }
  return vectors;
}

function show(text: string): string {
  return JSON.stringify(text);
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  const contracts = await loadContracts();
  if (command === "record" && arg) {
    const vectors = await run("typescript", contracts);
    writeFileSync(resolve(arg), JSON.stringify(vectors, null, 2) + "\n");
    console.log(`recorded ${vectors.length} vectors`);
    return;
  }
  if (command === "check" && arg) {
    const expected = JSON.parse(readFileSync(VECTORS, "utf-8")) as Vector[];
    const actual = await run(arg, contracts);
    if (actual.length !== expected.length) {
      throw new Error(`${arg}: ${actual.length} invocations, vectors.json has ${expected.length}`);
    }
    let failures = 0;
    actual.forEach((a, i) => {
      const e = expected[i]!;
      const same =
        a.contract === e.contract &&
        a.variant === e.variant &&
        JSON.stringify(a.argv) === JSON.stringify(e.argv) &&
        a.exitCode === e.exitCode &&
        a.stdout === e.stdout &&
        a.stderr === e.stderr;
      if (same) return;
      failures++;
      if (failures > 20) return;
      console.log(`FAIL ${e.contract} ${e.variant} ${JSON.stringify(e.argv)}`);
      if (a.exitCode !== e.exitCode) console.log(`  exit: expected ${e.exitCode}, got ${a.exitCode}`);
      if (a.stdout !== e.stdout) console.log(`  stdout: expected ${show(e.stdout)}\n          got      ${show(a.stdout)}`);
      if (a.stderr !== e.stderr) console.log(`  stderr: expected ${show(e.stderr)}\n          got      ${show(a.stderr)}`);
    });
    console.log(`${arg}: ${actual.length - failures} of ${actual.length} invocations match`);
    if (failures > 0) process.exitCode = 1;
    return;
  }
  console.error("usage: run.ts record <file> | check <typescript|go|rust|python|php>");
  process.exitCode = 2;
}

await main();
