import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runExplainDiff } from "../../../src/commands/explain-diff.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("explain-diff command", () => {
  it("returns dry-run result with diff explanation context", async () => {
    const { result, exitCode } = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
      { dryRun: true },
    );

    expect(exitCode).toBe(0);
    const r = result as { dryRun: boolean; prompt: string };
    expect(r.dryRun).toBe(true);
    expect(r.prompt).toContain("Diff Explanation Request");
  });

  it("dry-run context includes diff summary and changes", async () => {
    const { result } = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
      { dryRun: true },
    );

    const r = result as { prompt: string };
    expect(r.prompt).toContain("Diff Summary");
    expect(r.prompt).toContain("Has breaking changes:");
    expect(r.prompt).toContain("Versions");
  });

  it("dry-run context includes instructions", async () => {
    const { result } = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
      { dryRun: true },
    );

    const r = result as { prompt: string };
    expect(r.prompt).toContain("migration notes");
    expect(r.prompt).toContain("semver version bump");
    expect(r.prompt).toContain("release notes");
  });

  it("returns exit code 2 when old file is missing", async () => {
    const { exitCode } = await runExplainDiff(
      undefined,
      resolve(FIXTURES, "valid-contract.yaml"),
      { dryRun: true },
    );

    expect(exitCode).toBe(2);
  });

  it("returns exit code 2 when new file is missing", async () => {
    const { exitCode } = await runExplainDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      undefined,
      { dryRun: true },
    );

    expect(exitCode).toBe(2);
  });
});
