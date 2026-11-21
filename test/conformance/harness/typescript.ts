// The TypeScript conformance programs: the generated program.ts, bundled with
// commander, run once per invocation.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { build } from "esbuild";
import { generateTypeScript, toCamelCase } from "../../../src/generators/typescript.js";
import { CLIENT_CASES } from "../cases.js";
import {
  ARGV_SCRIPT,
  FAILING_COMMAND,
  PROGRAM_VERSION,
  VARIANTS,
  resultKey,
  type ConformanceContract,
  type Outcome,
  type Variant,
} from "../shared.js";

function harnessSource(c: ConformanceContract, variant: Variant): string {
  const ids = Object.fromEntries(c.spec.commands.map((cmd) => [toCamelCase(cmd.id), cmd.id]));
  const usage =
    variant === "usage"
      ? `{
  onUsageError(error, command) {
    process.stderr.write("USAGE " + JSON.stringify({ code: error.code, exitCode: error.exitCode, message: error.message, command: command.name() }) + "\\n");
    return 2;
  },
}`
      : "{}";
  return `import { createProgram } from "./gen/program.js";

const ids: Record<string, string> = ${JSON.stringify(ids)};
const sorted = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const handlers: Record<string, (...params: unknown[]) => Promise<string>> = {};
for (const [key, id] of Object.entries(ids)) {
  handlers[key] = async (...params: unknown[]) => {
    const parentOpts = params.pop() as Record<string, unknown>;
    const opts = params.pop() as Record<string, unknown>;
    process.stdout.write("HANDLER " + JSON.stringify({ command: id, args: params, opts: sorted(opts), globals: sorted(parentOpts) }) + "\\n");
    if (id === ${JSON.stringify(FAILING_COMMAND.id)}) process.exitCode = ${FAILING_COMMAND.exitCode};
    return "PROMPT " + String(params[0]);
  };
}

createProgram(handlers as never, ${JSON.stringify(PROGRAM_VERSION)}, ${usage}).parse(process.argv);
`;
}

function runOnce(script: string, argv: string[]): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...argv], { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on("data", (b: Buffer) => out.push(b));
    child.stderr.on("data", (b: Buffer) => err.push(b));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(out).toString("utf-8"),
        stderr: Buffer.concat(err).toString("utf-8"),
      }),
    );
  });
}

async function runAll(script: string, argvs: string[][]): Promise<Outcome[]> {
  const outcomes: Outcome[] = new Array(argvs.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < argvs.length) {
      const i = next++;
      outcomes[i] = await runOnce(script, argvs[i]!);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return outcomes;
}

export async function runTypeScript(contracts: ConformanceContract[], workDir: string): Promise<Map<string, Outcome[]>> {
  const results = new Map<string, Outcome[]>();
  for (const c of contracts) {
    const dir = join(workDir, c.name);
    mkdirSync(join(dir, "gen"), { recursive: true });
    for (const [file, content] of Object.entries(generateTypeScript(c.ctx, { contractYaml: c.yaml }))) {
      writeFileSync(join(dir, "gen", file), content);
    }
    for (const variant of VARIANTS) {
      const entry = join(dir, `main-${variant}.ts`);
      const script = join(dir, `main-${variant}.cjs`);
      writeFileSync(entry, harnessSource(c, variant));
      await build({ entryPoints: [entry], bundle: true, platform: "node", format: "cjs", outfile: script, logLevel: "error" });
      results.set(resultKey(c.file, variant), await runAll(script, c.argv));
    }
  }
  return results;
}

/** Runs every command wrapper call of CLIENT_CASES with argv.sh, in one process. */
export async function runTypeScriptClient(contracts: ConformanceContract[], workDir: string): Promise<Outcome[]> {
  const dir = join(workDir, "client");
  mkdirSync(dir, { recursive: true });
  const imports: string[] = [];
  const calls: string[] = [];
  for (const c of contracts) {
    mkdirSync(join(dir, c.name), { recursive: true });
    for (const [file, content] of Object.entries(generateTypeScript(c.ctx, { contractYaml: c.yaml }))) {
      writeFileSync(join(dir, c.name, file), content);
    }
    imports.push(`import * as ${c.name} from "./${c.name}/commands.js";`);
  }
  for (const k of CLIENT_CASES) {
    const c = contracts.find((x) => x.file === k.contract)!;
    const cmd = c.ctx.command_sets.flatMap((cs) => cs.commands).find((x) => x.id === k.command)!;
    const params = [JSON.stringify(ARGV_SCRIPT)];
    if (cmd.arguments.length > 0) params.push(JSON.stringify(k.args ?? {}));
    if (cmd.options.length > 0 && k.options !== undefined) params.push(JSON.stringify(k.options));
    calls.push(`  results.push(await ${c.name}.${toCamelCase(cmd.full_id)}(${params.join(", ")}));`);
  }
  const entry = join(dir, "main.ts");
  writeFileSync(
    entry,
    `${imports.join("\n")}
import { writeFileSync } from "node:fs";

async function main(): Promise<void> {
  const results: unknown[] = [];
${calls.join("\n")}
  writeFileSync(process.argv[2]!, JSON.stringify(results));
}

void main();
`,
  );
  const script = join(dir, "main.cjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "cjs", outfile: script, logLevel: "error" });
  const out = join(dir, "results.json");
  const { exitCode } = await runOnce(script, [out]);
  if (exitCode !== 0) throw new Error(`typescript: the command wrappers exited ${exitCode}`);
  return JSON.parse(readFileSync(out, "utf-8")) as Outcome[];
}
