import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runAuditCommand } from "../../../src/commands/audit.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("audit command", () => {
  it("returns dry-run result with prompt context", async () => {
    const { result, exitCode } = await runAuditCommand(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { dryRun: true },
    );

    expect(exitCode).toBe(0);
    const r = result as { dryRun: boolean; prompt: string };
    expect(r.dryRun).toBe(true);
    expect(r.prompt).toContain("Design Audit Request");
    expect(r.prompt).toContain("Full Contract");
  });

  it("dry-run includes checks when specified", async () => {
    const { result } = await runAuditCommand(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { dryRun: true, checks: ["agent-policy", "exit-code"] },
    );

    const r = result as { prompt: string };
    expect(r.prompt).toContain("Requested Checks");
    expect(r.prompt).toContain("agent-policy");
    expect(r.prompt).toContain("exit-code");
  });

  it("returns exit code 2 for invalid contract", async () => {
    const { exitCode } = await runAuditCommand(
      [resolve(FIXTURES, "invalid-contract.yaml")],
      { dryRun: true },
    );

    expect(exitCode).toBe(2);
  });

  it("accepts --file option override", async () => {
    const { result, exitCode } = await runAuditCommand(
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

  it("handles single check string", async () => {
    const { result, exitCode } = await runAuditCommand(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { dryRun: true, checks: "agent-policy" },
    );

    expect(exitCode).toBe(0);
    const r = result as { prompt: string };
    expect(r.prompt).toContain("agent-policy");
  });
});
