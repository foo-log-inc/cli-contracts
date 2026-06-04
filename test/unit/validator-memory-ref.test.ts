import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../src/parser.js";
import { validateContract, validateMemoryRef } from "../../src/validator.js";
import {
  MemoryRefSchema,
  MemoryRefSpecSchema,
  CommandSchema,
} from "../../src/schema.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("memory_ref schema", () => {
  it("parses a valid contract with memory_ref", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-memory-ref.yaml"),
    );
    expect(doc.command_sets["test-tool"].commands.analyze.memory_ref).toEqual({
      input: true,
      output: true,
    });
  });

  it("validates MemoryRefSpec on commands", () => {
    const parsed = CommandSchema.safeParse({
      summary: "Test command",
      memory_ref: { input: true, output: true },
      exits: { "0": { description: "OK" } },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.memory_ref).toEqual({ input: true, output: true });
    }
  });

  it("accepts contracts without memory_ref", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it("validates MemoryRef object shape", () => {
    const parsed = MemoryRefSchema.safeParse({
      id: "mem://run/abc123",
      provider: "test-provider",
      compat: "v1",
      created_at: "2026-06-03T05:00:00Z",
      parent_run_id: "run-001",
    });
    expect(parsed.success).toBe(true);
  });

  it("validates MemoryRefSpecSchema independently", () => {
    const parsed = MemoryRefSpecSchema.safeParse({ input: true, output: false });
    expect(parsed.success).toBe(true);
  });
});

describe("validateMemoryRef", () => {
  it("validates command with memory_ref input and output", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-memory-ref.yaml"),
    );
    const cmd = doc.command_sets["test-tool"].commands.analyze;
    const diagnostics = validateMemoryRef(
      cmd,
      "/command_sets/test-tool/commands/analyze",
    );
    expect(diagnostics).toHaveLength(0);

    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it("warns when memory_ref.output lacks side-effect declaration", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Memory Warn Test
  version: 1.0.0
command_sets:
  x:
    commands:
      run:
        summary: Run without effects.
        memory_ref:
          output: true
        exits:
          '0':
            description: OK.
`);
    const cmd = doc.command_sets.x.commands.run;
    const diagnostics = validateMemoryRef(cmd, "/command_sets/x/commands/run");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].rule).toBe("memory-ref-output-no-side-effects");
    expect(diagnostics[0].severity).toBe("warning");
  });
});
