import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runProposeTests } from "../../../src/commands/propose-tests.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("propose-tests command", () => {
  it("returns show-prompt result with test proposal context", async () => {
    const result = await runProposeTests(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Test Case Proposal Request");
  });

  it("show-prompt context includes command details", async () => {
    const result = await runProposeTests(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Test Case Proposal Request");
    expect(result as string).toContain("users.import");
    expect(result as string).toContain("Exit codes:");
  });

  it("show-prompt context includes x-agent and file contract details", async () => {
    const result = await runProposeTests(
      [resolve(FIXTURES, "valid-contract-with-xagent.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("safe-read");
    expect(result as string).toContain("dangerous-write");
    expect(result as string).toContain("x-agent:");
  });

  it("returns exit code 2 for invalid contract", async () => {
    const result = await runProposeTests(
      [resolve(FIXTURES, "invalid-contract.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).not.toBe("string");
    const { exitCode } = result as { result: unknown; exitCode: number };
    expect(exitCode).toBe(2);
  });

  it("accepts --file option override", async () => {
    const result = await runProposeTests(
      ["nonexistent.yaml"],
      {
        file: resolve(FIXTURES, "valid-contract.yaml"),
        showPrompt: true,
      },
    );

    expect(typeof result).toBe("string");
  });
});
