import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runProposeTests } from "../../../src/commands/propose-tests.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("propose-tests command", () => {
  it("returns dry-run result with test proposal context", async () => {
    const { result, exitCode } = await runProposeTests(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { dryRun: true },
    );

    expect(exitCode).toBe(0);
    const r = result as { dryRun: boolean; prompt: string };
    expect(r.dryRun).toBe(true);
    expect(r.prompt).toContain("Test Case Proposal Request");
  });

  it("dry-run context includes command details and test dimensions", async () => {
    const { result } = await runProposeTests(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { dryRun: true },
    );

    const r = result as { prompt: string };
    expect(r.prompt).toContain("Required argument missing");
    expect(r.prompt).toContain("Invalid option values");
    expect(r.prompt).toContain("File not found");
    expect(r.prompt).toContain("users.import");
  });

  it("dry-run context includes x-agent and file contract details", async () => {
    const { result } = await runProposeTests(
      [resolve(FIXTURES, "valid-contract-with-xagent.yaml")],
      { dryRun: true },
    );

    const r = result as { prompt: string };
    expect(r.prompt).toContain("safe-read");
    expect(r.prompt).toContain("dangerous-write");
    expect(r.prompt).toContain("x-agent:");
  });

  it("returns exit code 2 for invalid contract", async () => {
    const { exitCode } = await runProposeTests(
      [resolve(FIXTURES, "invalid-contract.yaml")],
      { dryRun: true },
    );

    expect(exitCode).toBe(2);
  });

  it("accepts --file option override", async () => {
    const { result, exitCode } = await runProposeTests(
      ["nonexistent.yaml"],
      {
        file: resolve(FIXTURES, "valid-contract.yaml"),
        dryRun: true,
      },
    );

    expect(exitCode).toBe(0);
    const r = result as { dryRun: boolean };
    expect(r.dryRun).toBe(true);
  });
});
