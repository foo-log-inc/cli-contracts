// Language conformance of the generated programs (TEST-DESIGN T1).
//
//   tsx test/conformance/run.ts record <dir>      run the TypeScript programs and command wrappers, and write
//                                                vectors.json and client-vectors.json to <dir>
//   tsx test/conformance/run.ts check <lang>      prepare, run and compare (needs the language's toolchain)
//   tsx test/conformance/run.ts prepare <lang>    write the <lang> programs and out/<lang>/run.sh
//   tsx test/conformance/run.ts compare <lang>    compare what out/<lang>/run.sh wrote with vectors.json
//                                                (<lang>: typescript, go, rust, python, php)
//
// Each contract under contracts/ generates a program in every language. Its
// handlers write what they receive as one `HANDLER <json>` line; created with
// `onUsageError`, the program writes `USAGE <json>` for an argument error and
// exits 2. Every invocation in cases.ts runs on both programs, and its exit
// code, stdout and stderr are compared byte for byte with the vector the
// TypeScript program (commander) recorded.
//
// The programs of the other languages run every invocation in one process and
// write their outcomes to out/<lang>/<contract>.json as
// `{"plain": [Outcome...], "usage": [Outcome...]}`.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseContractFile } from "../../src/parser.js";
import { resolveRefs } from "../../src/ref-resolver.js";
import { normalizeContract } from "../../src/normalizer.js";
import { buildRuntimeSpec } from "../../src/generators/runtime-spec.js";
import { CASES, CLIENT_CASES, type ClientCase } from "./cases.js";
import { runTypeScript, runTypeScriptClient } from "./harness/typescript.js";
import {
  HERE,
  VARIANTS,
  resultKey,
  type ConformanceContract,
  type LanguagePreparer,
  type Outcome,
  type Variant,
  type Vector,
} from "./shared.js";

const OUT = join(HERE, "out");
const VECTORS = join(HERE, "vectors.json");
const CLIENT_VECTORS = join(HERE, "client-vectors.json");

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

async function preparerFor(lang: string): Promise<LanguagePreparer> {
  switch (lang) {
    case "go":
      return (await import("./harness/go.js")).prepareGo;
    case "rust":
      return (await import("./harness/rust.js")).prepareRust;
    case "python":
      return (await import("./harness/python.js")).preparePython;
    case "php":
      return (await import("./harness/php.js")).preparePhp;
    default:
      throw new Error(`Unknown language: ${lang}`);
  }
}

function workDirOf(lang: string): string {
  return join(OUT, lang);
}

async function prepare(lang: string, contracts: ConformanceContract[]): Promise<string> {
  const workDir = workDirOf(lang);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  const script = (await preparerFor(lang))(contracts, workDir);
  const scriptPath = join(workDir, "run.sh");
  writeFileSync(scriptPath, `set -eu\n${script}\n`);
  return scriptPath;
}

function readResults(lang: string, contracts: ConformanceContract[]): Map<string, Outcome[]> {
  const results = new Map<string, Outcome[]>();
  for (const c of contracts) {
    const file = join(workDirOf(lang), `${c.name}.json`);
    if (!existsSync(file)) throw new Error(`${lang}: ${file} was not written`);
    const byVariant = JSON.parse(readFileSync(file, "utf-8")) as Record<Variant, Outcome[]>;
    for (const variant of VARIANTS) results.set(resultKey(c.file, variant), byVariant[variant] ?? []);
  }
  return results;
}

function toVectors(lang: string, contracts: ConformanceContract[], results: Map<string, Outcome[]>): Vector[] {
  const vectors: Vector[] = [];
  for (const c of contracts) {
    for (const variant of VARIANTS) {
      const outcomes = results.get(resultKey(c.file, variant));
      if (!outcomes || outcomes.length !== c.argv.length) {
        throw new Error(`${lang}: ${c.file} (${variant}) ran ${outcomes?.length ?? 0} of ${c.argv.length} invocations`);
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

function compare(lang: string, actual: Vector[]): boolean {
  const expected = JSON.parse(readFileSync(VECTORS, "utf-8")) as Vector[];
  if (actual.length !== expected.length) {
    console.log(`${lang}: ${actual.length} invocations, vectors.json has ${expected.length}`);
    return false;
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
    if (a.stdout !== e.stdout) console.log(`  stdout: expected ${JSON.stringify(e.stdout)}\n          got      ${JSON.stringify(a.stdout)}`);
    if (a.stderr !== e.stderr) console.log(`  stderr: expected ${JSON.stringify(e.stderr)}\n          got      ${JSON.stringify(a.stderr)}`);
  });
  console.log(`${lang}: ${actual.length - failures} of ${actual.length} invocations match`);
  return failures === 0;
}

/** The command wrappers' outcomes a language wrote to out/<lang>/client.json. */
function readClientResults(lang: string): Outcome[] {
  const file = join(workDirOf(lang), "client.json");
  if (!existsSync(file)) throw new Error(`${lang}: ${file} was not written`);
  return JSON.parse(readFileSync(file, "utf-8")) as Outcome[];
}

function compareClient(lang: string, actual: Outcome[]): boolean {
  const expected = JSON.parse(readFileSync(CLIENT_VECTORS, "utf-8")) as Array<ClientCase & Outcome>;
  if (actual.length !== expected.length || expected.length !== CLIENT_CASES.length) {
    console.log(`${lang}: ${actual.length} command wrapper calls, client-vectors.json has ${expected.length}`);
    return false;
  }
  let failures = 0;
  actual.forEach((a, i) => {
    const e = expected[i]!;
    if (a.exitCode === e.exitCode && a.stdout === e.stdout && a.stderr === e.stderr) return;
    failures++;
    console.log(`FAIL client ${e.contract} ${e.command} ${JSON.stringify(e.args ?? {})} ${JSON.stringify(e.options ?? null)}`);
    console.log(`  expected ${JSON.stringify(e)}\n  got      ${JSON.stringify(a)}`);
  });
  console.log(`${lang}: ${actual.length - failures} of ${actual.length} command wrapper calls match`);
  return failures === 0;
}

async function main(): Promise<void> {
  const [command, lang] = process.argv.slice(2);
  const contracts = await loadContracts();
  if (command === "record" && lang) {
    const vectors = toVectors("typescript", contracts, await runTypeScript(contracts, workDirOf("typescript")));
    const client = await runTypeScriptClient(contracts, workDirOf("typescript"));
    mkdirSync(resolve(lang), { recursive: true });
    writeFileSync(join(resolve(lang), "vectors.json"), JSON.stringify(vectors, null, 2) + "\n");
    writeFileSync(
      join(resolve(lang), "client-vectors.json"),
      JSON.stringify(CLIENT_CASES.map((k, i) => ({ ...k, ...client[i]! })), null, 2) + "\n",
    );
    console.log(`recorded ${vectors.length} vectors and ${client.length} command wrapper calls`);
    return;
  }
  if (lang === "typescript" && (command === "check" || command === "compare")) {
    const ok = compare(lang, toVectors(lang, contracts, await runTypeScript(contracts, workDirOf(lang))));
    const clientOk = compareClient(lang, await runTypeScriptClient(contracts, workDirOf(lang)));
    if (!ok || !clientOk) process.exitCode = 1;
    return;
  }
  if (command === "prepare" && lang) {
    console.log(await prepare(lang, contracts));
    return;
  }
  if ((command === "compare" || command === "check") && lang) {
    if (command === "check") {
      const script = await prepare(lang, contracts);
      const ran = spawnSync("sh", [script], { stdio: "inherit" });
      if (ran.status !== 0) {
        console.log(`${lang}: ${script} exited ${ran.status}`);
        process.exitCode = 1;
        return;
      }
    }
    const ok = compare(lang, toVectors(lang, contracts, readResults(lang, contracts)));
    const clientOk = compareClient(lang, readClientResults(lang));
    if (!ok || !clientOk) process.exitCode = 1;
    return;
  }
  console.error("usage: run.ts record <dir> | check|prepare|compare <typescript|go|rust|python|php>");
  process.exitCode = 2;
}

await main();
