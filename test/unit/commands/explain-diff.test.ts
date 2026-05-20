import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runExplainDiff } from "../../../src/commands/explain-diff.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("explain-diff command", () => {
  it("returns show-prompt result with diff explanation context", async () => {
    const result = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Diff Explanation Request");
  });

  it("show-prompt context includes diff summary and changes", async () => {
    const result = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Diff Summary");
    expect(result as string).toContain("Has breaking changes:");
    expect(result as string).toContain("Versions");
  });

  it("show-prompt context includes diff data", async () => {
    const result = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
      { showPrompt: true },
    );

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Diff Explanation Request");
    expect(result as string).toContain("Diff Summary");
    expect(result as string).toContain("Changes");
  });

  it("returns exit code 2 when old file is missing", async () => {
    const result = await runExplainDiff(
      undefined,
      resolve(FIXTURES, "valid-contract.yaml"),
      { showPrompt: true },
    );

    expect(typeof result).not.toBe("string");
    const { exitCode } = result as { result: unknown; exitCode: number };
    expect(exitCode).toBe(2);
  });

  it("returns exit code 2 when new file is missing", async () => {
    const result = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      undefined,
      { showPrompt: true },
    );

    expect(typeof result).not.toBe("string");
    const { exitCode } = result as { result: unknown; exitCode: number };
    expect(exitCode).toBe(2);
  });
});
