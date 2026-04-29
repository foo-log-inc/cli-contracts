import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseContractFile } from "../../src/parser.js";
import { resolveRefs } from "../../src/ref-resolver.js";
import { normalizeContract } from "../../src/normalizer.js";
import { runGenerators } from "../../src/generators/index.js";
import type { GeneratorConfig } from "../../src/types.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("generate integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "cli-contracts-gen-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("generates markdown documentation to file", async () => {
    let doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    doc = resolveRefs(doc);
    const ctx = normalizeContract(doc);

    const outputPath = join(tmpDir, "cli-reference.md");
    const generators: Record<string, GeneratorConfig> = {
      markdown: {
        enabled: true,
        output: outputPath,
        templates: "builtin:markdown",
      },
    };

    const result = await runGenerators(ctx, generators);
    expect(result.generators[0].status).toBe("success");
    expect(result.generators[0].files.length).toBe(1);

    const md = await readFile(outputPath, "utf-8");
    expect(md).toContain("# Test CLI");
    expect(md).toContain("### users.import");
    expect(md).toContain("#### Exit Codes");
  });

  it("generates typescript files to directory", async () => {
    let doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    doc = resolveRefs(doc);
    const ctx = normalizeContract(doc);

    const outputDir = join(tmpDir, "ts-output");
    const generators: Record<string, GeneratorConfig> = {
      typescript: {
        enabled: true,
        output: outputDir,
        templates: "builtin:typescript",
        options: { emitTypes: true, emitClient: true, emitValidators: true },
      },
    };

    const result = await runGenerators(ctx, generators);
    expect(result.generators[0].status).toBe("success");

    const files = await readdir(outputDir);
    expect(files).toContain("index.ts");
    expect(files).toContain("types.ts");
    expect(files).toContain("commands.ts");
    expect(files).toContain("schemas.ts");

    const types = await readFile(join(outputDir, "types.ts"), "utf-8");
    expect(types).toContain("export interface UserList");
    expect(types).toContain("export type UsersImportExitCode");
    expect(types).toContain("export type UsersImportExitResult");

    const commands = await readFile(join(outputDir, "commands.ts"), "utf-8");
    expect(commands).toContain("export async function");

    const schemas = await readFile(join(outputDir, "schemas.ts"), "utf-8");
    expect(schemas).toContain("export const schemas");
  });

  it("skips disabled generators", async () => {
    let doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    doc = resolveRefs(doc);
    const ctx = normalizeContract(doc);

    const generators: Record<string, GeneratorConfig> = {
      markdown: {
        enabled: false,
        output: join(tmpDir, "md-output.md"),
        templates: "builtin:markdown",
      },
    };

    const result = await runGenerators(ctx, generators);
    expect(result.generators[0].status).toBe("skipped");
  });

  it("filters generators by name", async () => {
    let doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    doc = resolveRefs(doc);
    const ctx = normalizeContract(doc);

    const generators: Record<string, GeneratorConfig> = {
      markdown: {
        enabled: true,
        output: join(tmpDir, "md-output.md"),
        templates: "builtin:markdown",
      },
      typescript: {
        enabled: true,
        output: join(tmpDir, "ts-output"),
        templates: "builtin:typescript",
      },
    };

    const result = await runGenerators(ctx, generators, ["markdown"]);
    expect(result.generators.length).toBe(1);
    expect(result.generators[0].name).toBe("markdown");
  });

  it("dry-run does not write files", async () => {
    let doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    doc = resolveRefs(doc);
    const ctx = normalizeContract(doc);

    const outputPath = join(tmpDir, "dry-run-output.md");
    const generators: Record<string, GeneratorConfig> = {
      markdown: {
        enabled: true,
        output: outputPath,
        templates: "builtin:markdown",
      },
    };

    const result = await runGenerators(
      ctx,
      generators,
      undefined,
      undefined,
      true,
    );
    expect(result.generators[0].status).toBe("success");

    await expect(readFile(outputPath, "utf-8")).rejects.toThrow();
  });
});
