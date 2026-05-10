import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runSuggest } from "../../../src/commands/suggest.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("suggest command", () => {
  it("returns dry-run result with suggest context from README", async () => {
    const { result, exitCode } = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      dryRun: true,
    });

    expect(exitCode).toBe(0);
    const r = result as { dryRun: boolean; prompt: string };
    expect(r.dryRun).toBe(true);
    expect(r.prompt).toContain("Suggestion Request");
    expect(r.prompt).toContain("Source: README");
  });

  it("dry-run context includes generation instructions", async () => {
    const { result } = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      dryRun: true,
    });

    const r = result as { prompt: string };
    expect(r.prompt).toContain("confidence score");
    expect(r.prompt).toContain("exit codes");
    expect(r.prompt).toContain("x-agent policies");
  });

  it("returns exit code 2 when no source is provided", async () => {
    const { exitCode } = await runSuggest({
      dryRun: true,
    });

    expect(exitCode).toBe(2);
  });

  it("accepts --from-source option", async () => {
    const { result, exitCode } = await runSuggest({
      fromSource: resolve(FIXTURES, "../../src/cli.ts"),
      dryRun: true,
    });

    expect(exitCode).toBe(0);
    const r = result as { prompt: string };
    expect(r.prompt).toContain("Source: CLI source code");
  });

  it("accepts multiple sources simultaneously", async () => {
    const { result, exitCode } = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      fromSource: resolve(FIXTURES, "../../src/cli.ts"),
      dryRun: true,
    });

    expect(exitCode).toBe(0);
    const r = result as { prompt: string };
    expect(r.prompt).toContain("Source: README");
    expect(r.prompt).toContain("Source: CLI source code");
  });
});
