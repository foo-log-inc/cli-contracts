import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../src/parser.js";
import { validateContract } from "../../src/validator.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("validateContract", () => {
  it("validates a correct contract without errors", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it("validates a minimal contract without errors", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "minimal-contract.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  // ── Structural checks (now caught by Zod at parse time) ─────

  it("rejects missing info.title at parse time", () => {
    expect(() =>
      parseContractString(`
cli_contracts: 0.1.0
info:
  title: ""
  version: 1.0.0
command_sets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
`),
    ).toThrow(/info\.title/);
  });

  it("rejects missing command summary at parse time", () => {
    expect(() =>
      parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      broken:
        exits:
          '0':
            description: OK.
`),
    ).toThrow(/summary/);
  });

  it("rejects empty commandSets at parse time", () => {
    expect(() =>
      parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets: {}
`),
    ).toThrow(/At least one command set/);
  });

  // ── Semantic checks (validator) ─────────────────────────────

  it("detects duplicate command paths", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const dupPath = result.errors.filter((e) => e.rule === "duplicate-command-path");
    expect(dupPath.length).toBeGreaterThan(0);
  });

  it("detects invalid exit codes (>255)", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const invalidExit = result.errors.filter(
      (e) => e.rule === "invalid-exit-code",
    );
    expect(invalidExit.length).toBeGreaterThan(0);
  });

  it("detects duplicate option names", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const dupOpt = result.errors.filter(
      (e) => e.rule === "duplicate-option-name",
    );
    expect(dupOpt.length).toBeGreaterThan(0);
  });

  it("detects duplicate option aliases", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const dupAlias = result.errors.filter(
      (e) => e.rule === "duplicate-option-alias",
    );
    expect(dupAlias.length).toBeGreaterThan(0);
  });

  it("detects variadic argument not last", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const variadicErr = result.errors.filter(
      (e) => e.rule === "variadic-not-last",
    );
    expect(variadicErr.length).toBeGreaterThan(0);
  });

  it("detects unresolved $ref", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const unresolved = result.errors.filter(
      (e) => e.rule === "unresolved-ref",
    );
    expect(unresolved.length).toBeGreaterThan(0);
  });

  it("warns on stream schema conflict", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Stream Test
  version: 0.1.0
command_sets:
  x:
    commands:
      filter:
        summary: Filter.
        streams:
          stdin:
            required: true
            format: ndjson
            framing:
              type: line-delimited
            schema:
              type: object
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const streamWarn = result.warnings.filter(
      (w) => w.rule === "stream-schema-conflict",
    );
    expect(streamWarn.length).toBeGreaterThan(0);
  });

  it("accepts a groups entry that matches a real command prefix", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      components.build:
        summary: Build components.
        exits:
          '0':
            description: OK.
    groups:
      components:
        description: Manage components.
`);
    const result = validateContract(doc);
    expect(
      result.warnings.filter((w) => w.rule === "orphan-group"),
    ).toHaveLength(0);
  });

  it("warns when a groups entry references a path with no commands under it", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      components.build:
        summary: Build components.
        exits:
          '0':
            description: OK.
    groups:
      nonexistent:
        description: Nothing here.
`);
    const result = validateContract(doc);
    const orphan = result.warnings.filter((w) => w.rule === "orphan-group");
    expect(orphan).toHaveLength(1);
    expect(orphan[0].message).toContain("nonexistent");
  });
});
