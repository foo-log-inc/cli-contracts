import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../src/parser.js";
import { validateContract } from "../../src/validator.js";
import {
  validateXAgentDeprecation,
  validateEffectsConsistency,
} from "../../src/validator.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("effects validation", () => {
  it("validates a contract with effects without errors", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("parses option-level effects correctly", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const lintCmd = doc.commandSets["effects-cli"].commands.lint;
    const fixOpt = lintCmd.options?.find((o) => o.name === "fix");
    expect(fixOpt?.effects).toBeDefined();
    expect(fixOpt?.effects?.riskLevel).toBe("medium");
    expect(fixOpt?.effects?.writes).toHaveLength(1);
  });

  it("parses command-level effects correctly", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const buildCmd = doc.commandSets["effects-cli"].commands.build;
    expect(buildCmd.effects).toBeDefined();
    expect(buildCmd.effects?.riskLevel).toBe("low");
    expect(buildCmd.effects?.writes).toHaveLength(1);
  });

  it("parses env sensitive attribute", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const env = doc.commandSets["effects-cli"].env!;
    expect(env.OPENAI_API_KEY.sensitive).toBe(true);
    expect(env.LOG_LEVEL.sensitive).toBeUndefined();
  });
});

describe("x-agent deprecation warnings", () => {
  it("warns when deprecated x-agent fields co-exist with effects", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      lint:
        summary: Lint files.
        options:
          - name: fix
            schema: { type: boolean }
            effects:
              riskLevel: medium
              writes:
                - target: "source files"
                  overwrite: true
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: low
          sideEffects: [file_write]
          sideEffectNote: "only when --fix"
          idempotent: true
`);
    const result = validateContract(doc);
    const deprecationWarnings = result.warnings.filter(
      (w) => w.rule === "xagent-deprecated-field",
    );
    expect(deprecationWarnings.length).toBeGreaterThanOrEqual(2);
    const fields = deprecationWarnings.map((w) => {
      const match = w.path.match(/x-agent\/(.+)$/);
      return match?.[1];
    });
    expect(fields).toContain("riskLevel");
    expect(fields).toContain("sideEffects");
  });

  it("does not warn for non-derivable x-agent fields", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      lint:
        summary: Lint files.
        options:
          - name: fix
            schema: { type: boolean }
            effects:
              riskLevel: medium
        exits:
          '0':
            description: OK.
        x-agent:
          idempotent: true
          recommendedBeforeUse:
            - "Run without --fix first"
`);
    const result = validateContract(doc);
    const deprecationWarnings = result.warnings.filter(
      (w) => w.rule === "xagent-deprecated-field",
    );
    expect(deprecationWarnings).toHaveLength(0);
  });

  it("errors when x-agent.riskLevel contradicts effects derivation", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      deploy:
        summary: Deploy app.
        effects:
          riskLevel: high
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: low
`);
    const result = validateContract(doc);
    const contradictions = result.errors.filter(
      (e) => e.rule === "xagent-effects-contradiction",
    );
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].message).toContain('"low"');
    expect(contradictions[0].message).toContain('"high"');
  });

  it("no contradiction error when x-agent.riskLevel matches", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: Test
  version: 1.0.0
commandSets:
  x:
    commands:
      build:
        summary: Build project.
        effects:
          riskLevel: low
        exits:
          '0':
            description: OK.
        x-agent:
          riskLevel: medium
`);
    const result = validateContract(doc);
    const contradictions = result.errors.filter(
      (e) => e.rule === "xagent-effects-contradiction",
    );
    expect(contradictions).toHaveLength(0);
  });
});

describe("validateXAgentDeprecation standalone", () => {
  it("flags all known deprecated fields", () => {
    const xAgent = {
      riskLevel: "low",
      sideEffects: ["file_write"],
      sideEffectNote: "only with --fix",
      requiresConfirmation: false,
      requiresConfirmationWhen: "always",
      dangerousOptions: ["force"],
      safeDryRunOption: "--dry-run",
      requiresNetwork: true,
      requiresSecrets: ["API_KEY"],
      reads: ["config"],
      writes: ["output"],
    };
    const diags = validateXAgentDeprecation(xAgent, "/test/cmd");
    expect(diags).toHaveLength(11);
    expect(diags.every((d) => d.rule === "xagent-deprecated-field")).toBe(true);
  });

  it("returns empty for non-deprecated fields only", () => {
    const xAgent = {
      idempotent: true,
      recommendedBeforeUse: ["check first"],
      rollback: { supported: true },
      humanReview: { required: false },
    };
    const diags = validateXAgentDeprecation(xAgent, "/test/cmd");
    expect(diags).toHaveLength(0);
  });
});

describe("validateEffectsConsistency standalone", () => {
  it("detects riskLevel contradiction with option effects", () => {
    const cmd = {
      summary: "Test",
      exits: { "0": { description: "OK." } },
      options: [
        {
          name: "force",
          schema: { type: "boolean" } as Record<string, unknown>,
          effects: { riskLevel: "high" as const },
        },
      ],
      "x-agent": { riskLevel: "low" },
    };
    const diags = validateEffectsConsistency(
      cmd as never,
      "test",
      "/test/cmd",
    );
    expect(diags).toHaveLength(1);
    expect(diags[0].rule).toBe("xagent-effects-contradiction");
  });
});
