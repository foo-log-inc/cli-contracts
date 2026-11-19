import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import { parseContractFile } from "../../src/parser.js";
import { resolveRefs } from "../../src/ref-resolver.js";
import { normalizeContract } from "../../src/normalizer.js";
import { runGenerators } from "../../src/generators/index.js";
import type { GeneratorConfig } from "../../src/types.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");
const REPO_ROOT = resolve(import.meta.dirname, "../..");

/**
 * Compiler options of a strict consumer. `noUnusedLocals` /
 * `noUnusedParameters` are what make unread generated identifiers an error.
 */
const CONSUMER_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts"],
  strict: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  noImplicitReturns: true,
  noFallthroughCasesInSwitch: true,
  skipLibCheck: true,
  resolveJsonModule: true,
  isolatedModules: true,
  noEmit: true,
  // Generated code imports commander and uses node globals; resolve both from
  // this repo regardless of where the generated files were written.
  baseUrl: REPO_ROOT,
  paths: { "*": ["node_modules/*"] },
  typeRoots: [join(REPO_ROOT, "node_modules", "@types")],
  types: ["node"],
};

async function generateInto(outputDir: string, fixture: string): Promise<void> {
  const contractPath = resolve(FIXTURES, fixture);
  let doc = await parseContractFile(contractPath);
  doc = resolveRefs(doc, { basePath: FIXTURES });
  const ctx = normalizeContract(doc);
  const contractYaml = await readFile(contractPath, "utf-8");

  const generators: Record<string, GeneratorConfig> = {
    typescript: {
      enabled: true,
      output: outputDir,
      templates: "builtin:typescript",
    },
  };

  const result = await runGenerators(
    ctx,
    generators,
    undefined,
    undefined,
    false,
    false,
    contractYaml,
  );
  expect(result.generators[0].status).toBe("success");
}

async function collectTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectTsFiles(full)));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

function typecheck(files: string[]): string[] {
  const program = ts.createProgram(files, CONSUMER_COMPILER_OPTIONS);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file !== undefined && files.includes(d.file.fileName))
    .map((d) => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
      const position =
        d.file && d.start !== undefined
          ? (() => {
              const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
              return `${d.file.fileName}(${line + 1},${character + 1})`;
            })()
          : "";
      return `${position}: error TS${d.code}: ${message}`;
    });
}

describe("generated TypeScript compiles under a strict consumer tsconfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "cli-contracts-typecheck-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * Both branches of the effects gate need compiling: a contract with effects
   * emits policy.ts plus the policy import into program.ts, and a contract
   * without effects keeps the underscored action parameter shape.
   */
  const FIXTURES_UNDER_TEST = [
    "strict-typecheck-contract.yaml",
    "valid-contract.yaml",
    "valid-contract-with-effects.yaml",
    "non-identifier-names-contract.yaml",
  ];

  for (const fixture of FIXTURES_UNDER_TEST) {
    it(`compiles ${fixture} with zero diagnostics`, async () => {
      await generateInto(tmpDir, fixture);
      const files = await collectTsFiles(tmpDir);
      expect(files.length).toBeGreaterThan(0);

      const diagnostics = typecheck(files);
      expect(diagnostics.join("\n")).toBe("");
    });
  }

  it("writes contract names and values that are not identifiers as quoted keys and string literals", async () => {
    await generateInto(tmpDir, "non-identifier-names-contract.yaml");
    const types = await readFile(join(tmpDir, "types.ts"), "utf-8");

    // A module of types only: nothing from the contract reaches it as code.
    const emitted = ts.transpileModule(types, {
      compilerOptions: { module: ts.ModuleKind.ESNext, removeComments: true },
    }).outputText;
    expect(emitted.trim()).toBe("export {};");
    // Each enum value keeps its exact characters.
    const quoted = ['say "hi"; then stop', "C:\\temp"].map((v) => JSON.stringify(v)).join(" | ");
    expect(types).toContain(`export type Quoted = ${quoted};`);
    expect(types).toContain('  "content-type": string;');
    expect(types).toContain('"x-request-id"?: string');
    expect(types).toContain('  "cache-control"?: string;');
  });

  it("merges allOf branches that re-declare a base property", async () => {
    await generateInto(tmpDir, "strict-typecheck-contract.yaml");
    const types = await readFile(join(tmpDir, "types.ts"), "utf-8");

    const proposal = types
      .split("export interface Proposal {")[1]
      .split("}\n")[0];
    const declarations = proposal.match(/^\s{2}(\w+)\??:/gm) ?? [];
    const names = declarations.map((d) => d.trim().replace(/\??:$/, ""));

    expect(names).toEqual(["summary", "riskLevel", "notes", "phases"]);
    // required in the base branch stays required after the merge
    expect(proposal).toContain("summary: string;");
    expect(proposal).not.toContain("summary?: string;");
  });
});
