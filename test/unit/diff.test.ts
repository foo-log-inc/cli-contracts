import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runDiff } from "../../src/commands/diff.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("runDiff", () => {
  it("detects no changes between identical files", async () => {
    const result = await runDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    expect(result.hasBreakingChanges).toBe(false);
    expect(result.changes.length).toBe(0);
  });

  it("detects added command sets", async () => {
    const result = await runDiff(
      resolve(FIXTURES, "minimal-contract.yaml"),
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const added = result.changes.filter(
      (c) => c.type === "added" && c.path.startsWith("/commandSets/"),
    );
    expect(added.length).toBeGreaterThan(0);
  });

  it("detects removed command sets", async () => {
    const result = await runDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "minimal-contract.yaml"),
    );
    const removed = result.changes.filter(
      (c) => c.type === "removed" && c.breaking,
    );
    expect(removed.length).toBeGreaterThan(0);
    expect(result.hasBreakingChanges).toBe(true);
  });

  it("breakingOnly filters non-breaking changes", async () => {
    const result = await runDiff(
      resolve(FIXTURES, "minimal-contract.yaml"),
      resolve(FIXTURES, "valid-contract.yaml"),
      { breakingOnly: true },
    );
    for (const change of result.changes) {
      expect(change.breaking).toBe(true);
    }
  });
});
