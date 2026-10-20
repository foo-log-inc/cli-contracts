import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseContractFile } from "../../src/parser.js";
import { normalizeContract } from "../../src/normalizer.js";
import { generateTypeScript } from "../../src/generators/typescript.js";
import { build } from "esbuild";
import {
  LARGE_CONTRACT_COMMAND_SET,
  largeContractYaml,
} from "../fixtures/large-contract.js";

const execFileAsync = promisify(execFile);
const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("generated code standalone compilation", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "cli-contracts-standalone-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("generated TypeScript has no runtime imports from cli-contracts", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    for (const [filename, content] of Object.entries(output)) {
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.trimStart().startsWith("//")) continue;
        expect(line, `${filename} has runtime import from cli-contracts`).not.toMatch(
          /from\s+["']cli-contracts/,
        );
      }
    }
  });

  it("policy files compile without cli-contracts installed", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    const srcDir = join(tmpDir, "src");
    await mkdir(srcDir, { recursive: true });

    const policyFiles = ["policy.ts", "policy-runtime.ts"];
    for (const filename of policyFiles) {
      expect(output, `${filename} must be generated`).toHaveProperty(filename);
      await writeFile(join(srcDir, filename), output[filename], "utf-8");
    }

    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ["src/**/*"],
    };
    await writeFile(
      join(tmpDir, "tsconfig.json"),
      JSON.stringify(tsconfig),
      "utf-8",
    );

    const tsc = resolve(
      import.meta.dirname,
      "../../node_modules/.bin/tsc",
    );

    const { stdout, stderr } = await execFileAsync(tsc, ["--noEmit"], {
      cwd: tmpDir,
      timeout: 30000,
    });

    expect(stderr).toBe("");
  });

  it("policy-runtime.ts is emitted alongside policy.ts", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output).toHaveProperty("policy.ts");
    expect(output).toHaveProperty("policy-runtime.ts");

    const policyTs = output["policy.ts"];
    expect(policyTs).toContain('from "./policy-runtime.js"');
    expect(policyTs).not.toContain('from "cli-contracts');
  });

  it("contract without effects does not emit policy files", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output).not.toHaveProperty("policy.ts");
    expect(output).not.toHaveProperty("policy-runtime.ts");
  });

  it("generated extract delivers the whole of an output larger than one pipe buffer", async () => {
    const commandCount = 3000;
    const contractPath = join(tmpDir, "cli-contract.yaml");
    const contractYaml = largeContractYaml(commandCount);
    await writeFile(contractPath, contractYaml, "utf-8");
    const ctx = normalizeContract(await parseContractFile(contractPath));
    const output = generateTypeScript(ctx, { contractYaml });

    const srcDir = join(tmpDir, "src");
    await mkdir(srcDir, { recursive: true });
    for (const [filename, content] of Object.entries(output)) {
      await writeFile(join(srcDir, filename), content, "utf-8");
    }
    await writeFile(
      join(srcDir, "main.ts"),
      'import { createProgram } from "./program.js";\ncreateProgram({} as never, "1.0.0").parse();\n',
      "utf-8",
    );
    const bin = join(tmpDir, "main.cjs");
    await build({
      entryPoints: [join(srcDir, "main.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: bin,
      nodePaths: [resolve(import.meta.dirname, "../../node_modules")],
      logLevel: "silent",
    });

    const { stdout } = await execFileAsync(
      process.execPath,
      [bin, "extract", "--all", "-F", "json"],
      { timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
    );

    expect(stdout.length).toBeGreaterThan(256 * 1024);
    const doc = JSON.parse(stdout);
    expect(
      Object.keys(doc.command_sets[LARGE_CONTRACT_COMMAND_SET].commands),
    ).toHaveLength(commandCount);
  }, 60000);

  it("a missing required option ends with the exit and stderr the handler gives it, as the contract declares", async () => {
    const contractYaml = `cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  tool:
    commands:
      docs:
        summary: Generate docs.
        options:
          - name: entry
            aliases: [e]
            value_name: file
            required: true
            schema:
              type: string
        exits:
          '0':
            description: OK.
          '2':
            description: Invalid arguments.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
`;
    const contractPath = join(tmpDir, "cli-contract.yaml");
    await writeFile(contractPath, contractYaml, "utf-8");
    const output = generateTypeScript(normalizeContract(await parseContractFile(contractPath)), { contractYaml });

    const srcDir = join(tmpDir, "src");
    await mkdir(srcDir, { recursive: true });
    for (const [filename, content] of Object.entries(output)) {
      await writeFile(join(srcDir, filename), content, "utf-8");
    }
    // The handler implements the contract's exit 2 for invalid arguments.
    await writeFile(
      join(srcDir, "main.ts"),
      [
        'import { createProgram } from "./program.js";',
        "createProgram({",
        "  async docs(options) {",
        "    if (!options.entry) {",
        '      process.stderr.write(JSON.stringify({ code: "INVALID_ARGS", message: "Missing required option --entry." }) + "\\n");',
        "      process.exitCode = 2;",
        "    }",
        "  },",
        '}, "1.0.0").parse();',
        "",
      ].join("\n"),
      "utf-8",
    );
    const bin = join(tmpDir, "main.cjs");
    await build({
      entryPoints: [join(srcDir, "main.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: bin,
      nodePaths: [resolve(import.meta.dirname, "../../node_modules")],
      logLevel: "silent",
    });

    const failure = await execFileAsync(process.execPath, [bin, "docs"]).then(
      () => ({ code: 0, stderr: "" }),
      (err: { code: number; stderr: string }) => err,
    );

    expect(failure.code).toBe(2);
    expect(JSON.parse(failure.stderr)).toEqual({ code: "INVALID_ARGS", message: "Missing required option --entry." });
  }, 60000);

  it("an onUsageError given to createProgram ends commander's argument errors with the exit and stderr it gives them", async () => {
    const contractYaml = `cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  tool:
    commands:
      docs.build:
        summary: Build docs.
        arguments:
          - name: input
            required: true
            schema:
              type: string
        options:
          - name: entry
            value_name: file
            schema:
              type: string
        exits:
          '0':
            description: OK.
          '2':
            description: Invalid arguments.
            stderr:
              format: json
`;
    const contractPath = join(tmpDir, "cli-contract.yaml");
    await writeFile(contractPath, contractYaml, "utf-8");
    const output = generateTypeScript(normalizeContract(await parseContractFile(contractPath)), { contractYaml });
    const srcDir = join(tmpDir, "src");
    await mkdir(srcDir, { recursive: true });
    for (const [filename, content] of Object.entries(output)) {
      await writeFile(join(srcDir, filename), content, "utf-8");
    }
    const bin = async (name: string, programOptions: string) => {
      await writeFile(
        join(srcDir, `${name}.ts`),
        [
          'import { createProgram } from "./program.js";',
          `createProgram({ async docsBuild() {} }, "1.0.0"${programOptions}).parse();`,
          "",
        ].join("\n"),
        "utf-8",
      );
      const file = join(tmpDir, `${name}.cjs`);
      await build({
        entryPoints: [join(srcDir, `${name}.ts`)],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: file,
        nodePaths: [resolve(import.meta.dirname, "../../node_modules")],
        logLevel: "silent",
      });
      return (...args: string[]) =>
        execFileAsync(process.execPath, [file, ...args]).then(
          ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
          (err: { code: number; stdout: string; stderr: string }) => err,
        );
    };
    // The application writes the contract's exit 2 JSON and names the command.
    const withHook = await bin(
      "with-hook",
      ', { onUsageError: (error, command) => { process.stderr.write(JSON.stringify({ code: "INVALID_ARGS", command: command.name(), commander: error.code }) + "\\n"); return 2; } }',
    );
    const withoutHook = await bin("without-hook", "");

    const [unknown, noValue, noArgument, help, plain] = await Promise.all([
      withHook("docs", "build", "in.md", "--bogus"),
      withHook("docs", "build", "in.md", "--entry"),
      withHook("docs", "build"),
      withHook("docs", "build", "--help"),
      withoutHook("docs", "build", "in.md", "--bogus"),
    ]);

    expect([unknown.code, JSON.parse(unknown.stderr)]).toEqual([2, { code: "INVALID_ARGS", command: "build", commander: "commander.unknownOption" }]);
    expect([noValue.code, JSON.parse(noValue.stderr)]).toEqual([2, { code: "INVALID_ARGS", command: "build", commander: "commander.optionMissingArgument" }]);
    expect([noArgument.code, JSON.parse(noArgument.stderr)]).toEqual([2, { code: "INVALID_ARGS", command: "build", commander: "commander.missingArgument" }]);
    expect([help.code, help.stderr]).toEqual([0, ""]);
    expect(help.stdout).toContain("Usage: tool docs build");
    expect([plain.code, plain.stderr]).toEqual([1, "error: unknown option '--bogus'\n"]);
  }, 60000);

  it("generated extract leaves out its metadata with --no-include-meta", async () => {
    const contractYaml = await readFile(resolve(FIXTURES, "minimal-contract.yaml"), "utf-8");
    const ctx = normalizeContract(await parseContractFile(resolve(FIXTURES, "minimal-contract.yaml")));
    const output = generateTypeScript(ctx, { contractYaml });

    const srcDir = join(tmpDir, "src");
    await mkdir(srcDir, { recursive: true });
    for (const [filename, content] of Object.entries(output)) {
      await writeFile(join(srcDir, filename), content, "utf-8");
    }
    await writeFile(
      join(srcDir, "main.ts"),
      'import { createProgram } from "./program.js";\ncreateProgram({} as never, "1.0.0").parse();\n',
      "utf-8",
    );
    const bin = join(tmpDir, "main.cjs");
    await build({
      entryPoints: [join(srcDir, "main.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: bin,
      nodePaths: [resolve(import.meta.dirname, "../../node_modules")],
      logLevel: "silent",
    });
    const extract = async (...flags: string[]) =>
      JSON.parse((await execFileAsync(process.execPath, [bin, "extract", "--all", "-F", "json", ...flags])).stdout);

    expect(await extract()).toHaveProperty("_meta");
    expect(await extract("--no-include-meta")).not.toHaveProperty("_meta");
  }, 60000);
});
