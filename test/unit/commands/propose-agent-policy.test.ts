import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runProposeAgentPolicy } from "../../../src/commands/propose-agent-policy.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("propose-agent-policy command", () => {
  it("returns show-prompt result with prompt context", async () => {
    const result = await runProposeAgentPolicy(
      [resolve(FIXTURES, "valid-contract-with-xagent.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Policy Audit Request");
    expect(result as string).toContain("safe-read");
    expect(result as string).toContain("dangerous-write");
  });

  it("show-prompt includes x-agent policy details", async () => {
    const result = await runProposeAgentPolicy(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("users.import");
    expect(result as string).toContain("risk_level: high");
  });

  it("returns exit code 2 for invalid contract", async () => {
    const result = await runProposeAgentPolicy(
      [resolve(FIXTURES, "invalid-contract.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).not.toBe("string");
    const { exitCode } = result as { result: unknown; exitCode: number };
    expect(exitCode).toBe(2);
  });

  it("accepts --file option override", async () => {
    const result = await runProposeAgentPolicy(
      ["nonexistent.yaml"],
      {
        file: resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
        showPrompt: true,
      },
    );

    expect(typeof result).toBe("string");
  });
});
