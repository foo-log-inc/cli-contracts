import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../src/parser.js";
import { validateContract } from "../../src/validator.js";
import { validateXAgent } from "../../src/validator.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("x-agent validation", () => {
  it("validates a contract with complete x-agent policies", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it("warns when high riskLevel lacks requiresConfirmation", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      danger:
        summary: Dangerous command.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: high
          idempotent: false
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-high-risk-no-confirmation",
    );
    expect(warn.length).toBe(1);
    expect(warn[0].message).toContain("requires_confirmation");
  });

  it("warns when critical riskLevel lacks requiresConfirmation", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      critical-op:
        summary: Critical operation.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: critical
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-high-risk-no-confirmation",
    );
    expect(warn.length).toBe(1);
  });

  it("does not warn when high riskLevel has requires_confirmation: true", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      safe-danger:
        summary: Confirmed dangerous command.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: high
          requires_confirmation: true
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-high-risk-no-confirmation",
    );
    expect(warn.length).toBe(0);
  });

  it("warns when sideEffects present but idempotent not declared", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      side-effect-cmd:
        summary: Has side effects.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: medium
          side_effects:
            - database_write
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-side-effects-no-idempotent",
    );
    expect(warn.length).toBe(1);
  });

  it("does not warn when sideEffects has idempotent declared", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      side-effect-cmd:
        summary: Has side effects.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: medium
          side_effects:
            - database_write
          idempotent: false
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-side-effects-no-idempotent",
    );
    expect(warn.length).toBe(0);
  });

  it("validates existing valid-contract.yaml x-agent block", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
  });
});

describe("validateXAgent standalone", () => {
  it("returns error for non-object x-agent", () => {
    const diags = validateXAgent("not-an-object", "/test");
    expect(diags.length).toBe(1);
    expect(diags[0].rule).toBe("xagent-invalid-type");
  });

  it("returns empty for valid x-agent", () => {
    const diags = validateXAgent(
      { risk_level: "low", idempotent: true, side_effects: [] },
      "/test",
    );
    expect(diags.length).toBe(0);
  });

  it("allows passthrough of unknown fields", () => {
    const diags = validateXAgent(
      { risk_level: "low", customField: "allowed" },
      "/test",
    );
    expect(diags.length).toBe(0);
  });
});

describe("x-agent DSL binding fields", () => {
  it("accepts dsl_task alone", () => {
    const diags = validateXAgent(
      { risk_level: "low", dsl_task: "audit-something" },
      "/test",
    );
    expect(diags.length).toBe(0);
  });

  it("accepts dsl_workflow alone", () => {
    const diags = validateXAgent(
      { risk_level: "low", dsl_workflow: "audit-workflow" },
      "/test",
    );
    expect(diags.length).toBe(0);
  });

  it("rejects dsl_task and dsl_workflow together", () => {
    const diags = validateXAgent(
      { risk_level: "low", dsl_task: "audit-task", dsl_workflow: "audit-workflow" },
      "/test",
    );
    expect(diags.length).toBeGreaterThan(0);
    const mutualExclusive = diags.find(
      (d) => d.message.includes("mutually exclusive"),
    );
    expect(mutualExclusive).toBeDefined();
  });

  it("validates dsl_task and dsl_workflow in full contract", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      audit:
        summary: Audit something.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: low
          dsl_workflow: migration-audit
      generate:
        summary: Generate something.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: low
          dsl_task: implement-feature
`);
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
  });

  it("reports error when both dsl_task and dsl_workflow in same command", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      broken:
        summary: Broken command.
        exits:
          '0':
            description: OK.
        x-agent:
          risk_level: low
          dsl_task: some-task
          dsl_workflow: some-workflow
`);
    const result = validateContract(doc);
    const errors = result.errors.filter(
      (e) => e.message.includes("mutually exclusive"),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
