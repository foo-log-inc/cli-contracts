import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolve } from "node:path";

const executeTask = vi.fn();
vi.mock("agent-contracts-runtime", () => ({ executeTask }));

const { runAudit, EXIT_ADAPTER_ERROR } = await import("../../../src/auditor/auditor.js");
const { runAuditCommand } = await import("../../../src/commands/audit.js");
const { runSuggest } = await import("../../../src/commands/suggest.js");

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

function taskResult(outcome: Record<string, unknown>) {
  return { outcome, follow_ups_used: 0, retries_used: 0 };
}

const NOT_COMPLETED = [
  { outcome: { status: "error", message: "provider unavailable" }, message: "provider unavailable" },
  { outcome: { status: "escalation", reason: "needs a human" }, message: "needs a human" },
  { outcome: { status: "validation_error", errors: { message: "output does not match the schema" } }, message: "output does not match the schema" },
];

describe("an LLM task that does not complete", () => {
  beforeEach(() => executeTask.mockReset());

  for (const { outcome, message } of NOT_COMPLETED) {
    it(`ends with the adapter error exit when the runtime returns ${outcome.status}`, async () => {
      executeTask.mockResolvedValue(taskResult(outcome));

      await expect(runAudit("request", "audit-contract-design", {}, { taskId: "audit-contract-design", format: "json", failOn: "error" }))
        .rejects.toMatchObject({ exitCode: EXIT_ADAPTER_ERROR, message: expect.stringContaining(message) });
      await expect(runAuditCommand([resolve(FIXTURES, "valid-contract.yaml")], {}))
        .rejects.toMatchObject({ exitCode: EXIT_ADAPTER_ERROR });
      await expect(runSuggest({ fromReadme: resolve(FIXTURES, "../../README.md") }))
        .rejects.toMatchObject({ exitCode: EXIT_ADAPTER_ERROR });
    });
  }

  it("returns the task's data when the runtime returns success", async () => {
    const data = { summary: "ok", risk_level: "low", findings: [] };
    executeTask.mockResolvedValue(taskResult({ status: "success", data, raw: "{}" }));

    const result = await runAuditCommand([resolve(FIXTURES, "valid-contract.yaml")], {});
    expect(result).toEqual({ result: data, exitCode: 0 });
  });
});
