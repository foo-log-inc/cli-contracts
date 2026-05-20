import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runAuditCommand } from "../../../src/commands/audit.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("audit command", () => {
  it("returns show-prompt result with prompt context", async () => {
    const result = await runAuditCommand(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Design Audit Request");
    expect(result as string).toContain("Full Contract");
  });

  it("show-prompt includes checks when specified", async () => {
    const result = await runAuditCommand(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { showPrompt: true, checks: ["agent-policy", "exit-code"] },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Requested Checks");
    expect(result as string).toContain("agent-policy");
    expect(result as string).toContain("exit-code");
  });

  it("returns exit code 2 for invalid contract", async () => {
    const result = await runAuditCommand(
      [resolve(FIXTURES, "invalid-contract.yaml")],
      { showPrompt: true },
    );

    expect(typeof result).not.toBe("string");
    const { exitCode } = result as { result: unknown; exitCode: number };
    expect(exitCode).toBe(2);
  });

  it("accepts --file option override", async () => {
    const result = await runAuditCommand(
      ["nonexistent.yaml"],
      {
        file: resolve(FIXTURES, "valid-contract.yaml"),
        showPrompt: true,
      },
    );

    expect(typeof result).toBe("string");
  });

  it("handles single check string", async () => {
    const result = await runAuditCommand(
      [resolve(FIXTURES, "valid-contract.yaml")],
      { showPrompt: true, checks: "agent-policy" },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("agent-policy");
  });
});
