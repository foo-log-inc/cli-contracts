import { describe, it, expect } from "vitest";
import { join, resolve } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { parseContractFile, parseContractString } from "../../../src/parser.js";
import { resolveRefs } from "../../../src/ref-resolver.js";
import { normalizeContract } from "../../../src/normalizer.js";
import { generateTypeScript } from "../../../src/generators/typescript.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("generateTypeScript", () => {
  it("generates all output files", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output).toHaveProperty("index.ts");
    expect(output).toHaveProperty("types.ts");
    expect(output).toHaveProperty("commands.ts");
    expect(output).toHaveProperty("schemas.ts");
  });

  it("index.ts re-exports all modules", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["index.ts"]).toContain('export * from "./types.js"');
    expect(output["index.ts"]).toContain('export * from "./commands.js"');
    expect(output["index.ts"]).toContain('export * from "./schemas.js"');
  });

  it("generates argument interfaces", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      users.import:
        summary: Import users.
        arguments:
          - name: input
            required: true
            schema:
              type: string
          - name: extra
            required: false
            schema:
              type: string
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("export interface UsersImportArgs");
    expect(output["types.ts"]).toContain("input: string");
    expect(output["types.ts"]).toContain("extra?: string");
  });

  it("generates option interfaces", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      users.list:
        summary: List users.
        options:
          - name: format
            schema:
              type: string
              enum: [json, csv]
          - name: limit
            schema:
              type: integer
              default: 100
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("export interface UsersListOptions");
    expect(output["types.ts"]).toContain('format?: "json" | "csv"');
    expect(output["types.ts"]).toContain("limit?: number");
  });

  it("generates exit code union types", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      users.import:
        summary: Import.
        exits:
          '0':
            description: OK.
          '2':
            description: Error.
          '10':
            description: Partial.
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("export type UsersImportExitCode = 0 | 2 | 10;");
  });

  it("generates discriminated union result types", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      users.import:
        summary: Import.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/Result'
          '2':
            description: Error.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'
components:
  schemas:
    Result:
      type: object
    Error:
      type: object
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("export type UsersImportExitResult =");
    expect(output["types.ts"]).toContain("exitCode: 0; stdout: Result");
    expect(output["types.ts"]).toContain("exitCode: 2; stderr: Error");
  });

  it("generates component schema types", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("export interface UserList");
    expect(output["types.ts"]).toContain("export interface ImportResult");
    expect(output["types.ts"]).toContain("export interface Error");
    expect(output["types.ts"]).toContain("export interface Tenant");
  });

  it("generates command execution functions", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      users.list:
        summary: List users.
        options:
          - name: limit
            schema:
              type: integer
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["commands.ts"]).toContain("export async function fooUsersList");
    expect(output["commands.ts"]).toContain('["users","list"]');
    expect(output["commands.ts"]).toContain("--limit");
  });

  it("the client passes false for a boolean whose default is true as --no-<name>", async () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      build:
        summary: Build.
        options:
          - name: manifest
            schema:
              type: boolean
              default: true
          - name: dry-run
            schema:
              type: boolean
              default: false
        exits:
          '0':
            description: OK.
`);
    const output = generateTypeScript(normalizeContract(doc));
    const dir = await mkdtemp(join(tmpdir(), "cli-contracts-client-"));
    try {
      await writeFile(join(dir, "commands.ts"), output["commands.ts"], "utf-8");
      const bundle = join(dir, "commands.mjs");
      await build({
        entryPoints: [join(dir, "commands.ts")],
        outfile: bundle,
        bundle: true,
        format: "esm",
        platform: "node",
        logLevel: "silent",
      });
      const { fooBuild } = await import(pathToFileURL(bundle).href);
      // echo prints the argv the client hands to the executable
      const argv = async (options: Record<string, boolean>) =>
        ((await fooBuild("echo", options)) as { stdout: string }).stdout.trim();

      expect(await argv({ manifest: false })).toBe("build --no-manifest");
      expect(await argv({ manifest: true, dryRun: true })).toBe("build --manifest --dry-run");
      expect(await argv({ dryRun: false })).toBe("build");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("generates schema constants", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["schemas.ts"]).toContain("export const schemas =");
    expect(output["schemas.ts"]).toContain("UserList:");
    expect(output["schemas.ts"]).toContain("usersListExitCodes");
    expect(output["schemas.ts"]).toContain("usersImportExitCodes");
  });

  it("generates auto-generated header in all files", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    for (const [, content] of Object.entries(output)) {
      expect(content).toContain("Auto-generated by cli-contracts");
    }
  });

  it("handles variadic arguments", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      concat:
        summary: Concat files.
        arguments:
          - name: files
            required: true
            variadic: true
            schema:
              type: string
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("files: string[]");
  });

  it("respects emitTypes=false option", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx, { emitTypes: false });

    expect(output["types.ts"]).toContain("types generation disabled");
  });

  it("generates interface extends for allOf with $ref + object", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      run:
        summary: Run.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/ExtendedResult'
components:
  schemas:
    BaseResult:
      type: object
      required: [summary]
      properties:
        summary:
          type: string
        details:
          type: string
    ExtendedResult:
      allOf:
        - $ref: '#/components/schemas/BaseResult'
        - type: object
          required: [changedFiles]
          properties:
            changedFiles:
              type: array
              items:
                type: string
            notes:
              type: string
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    const types = output["types.ts"];

    expect(types).toContain("export interface ExtendedResult extends BaseResult {");
    expect(types).toContain("changedFiles: string[];");
    expect(types).toContain("notes?: string;");
  });

  it("generates type alias for allOf with only $refs", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      run:
        summary: Run.
        exits:
          '0':
            description: OK.
components:
  schemas:
    A:
      type: object
      required: [x]
      properties:
        x:
          type: string
    B:
      type: object
      required: [y]
      properties:
        y:
          type: number
    Combined:
      allOf:
        - $ref: '#/components/schemas/A'
        - $ref: '#/components/schemas/B'
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("export type Combined = A & B;");
  });

  it("generates intersection type for inline allOf in jsonSchemaToTs", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      run:
        summary: Run.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                type: object
                required: [data]
                properties:
                  data:
                    allOf:
                      - $ref: '#/components/schemas/Base'
                      - type: object
                        properties:
                          extra:
                            type: string
components:
  schemas:
    Base:
      type: object
      required: [id]
      properties:
        id:
          type: string
`);
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);

    expect(output["types.ts"]).toContain("Base & { extra?: string }");
  });
});
