import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runProposeAgentPolicy } from "../../../src/commands/propose-agent-policy.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("propose-agent-policy command", () => {
  it("returns show-prompt result with prompt context", async () => {
    const { result, exitCode } = await runProposeAgentPolicy(
      [resolve(FIXTURES, "valid-contract-with-xagent.yaml")],
      { showPrompt: true },
    );

    expect(exitCode).toBe(0);
    const r = result as { showPrompt: boolean; prompt: string };
    expect(r.showPrompt).toBe(true);
    expect(r.prompt).toContain("Policy Audit Request");
    expect(r.prompt).toContain("safe-read");
    expect(r.prompt).toContain("dangerous-write");
  });

  it("show-prompt includes x-agent policy details", async () => {
    const { result } = await runProposeAgentPolicy(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { showPrompt: true },
    );

    const r = result as { prompt: string };
    expect(r.prompt).toContain("users.import");
    expect(r.prompt).toContain("riskLevel: high");
  });

  it("returns exit code 2 for invalid contract", async () => {
    const { exitCode } = await runProposeAgentPolicy(
      [resolve(FIXTURES, "invalid-contract.yaml")],
      { showPrompt: true },
    );

    expect(exitCode).toBe(2);
  });

  it("accepts --file option override", async () => {
    const { result, exitCode } = await runProposeAgentPolicy(
      ["nonexistent.yaml"],
      {
        file: resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
        showPrompt: true,
      },
    );

    expect(exitCode).toBe(0);
    const r = result as { showPrompt: boolean };
    expect(r.showPrompt).toBe(true);
  });
});
