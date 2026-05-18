import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseContractFile } from "../../src/parser.js";
import { normalizeContract } from "../../src/normalizer.js";
import { generateTypeScript } from "../../src/generators/typescript.js";

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
});
