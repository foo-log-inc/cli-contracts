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
    expect(result.errorCount).toBe(0);
  });

  it("warns when high riskLevel lacks requiresConfirmation", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      danger:
        summary: Dangerous command.
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: high
          idempotent: false
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-high-risk-no-confirmation",
    );
    expect(warn.length).toBe(1);
    expect(warn[0].message).toContain("requiresConfirmation");
  });

  it("warns when critical riskLevel lacks requiresConfirmation", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      critical-op:
        summary: Critical operation.
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: critical
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-high-risk-no-confirmation",
    );
    expect(warn.length).toBe(1);
  });

  it("does not warn when high riskLevel has requiresConfirmation: true", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      safe-danger:
        summary: Confirmed dangerous command.
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: high
          requiresConfirmation: true
`);
    const result = validateContract(doc);
    const warn = result.warnings.filter(
      (w) => w.rule === "xagent-high-risk-no-confirmation",
    );
    expect(warn.length).toBe(0);
  });

  it("warns when sideEffects present but idempotent not declared", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      side-effect-cmd:
        summary: Has side effects.
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: medium
          sideEffects:
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
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      side-effect-cmd:
        summary: Has side effects.
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: medium
          sideEffects:
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
      { riskLevel: "low", idempotent: true, sideEffects: [] },
      "/test",
    );
    expect(diags.length).toBe(0);
  });

  it("allows passthrough of unknown fields", () => {
    const diags = validateXAgent(
      { riskLevel: "low", customField: "allowed" },
      "/test",
    );
    expect(diags.length).toBe(0);
  });
});
