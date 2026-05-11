import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runSuggest } from "../../../src/commands/suggest.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("suggest command", () => {
  it("returns show-prompt result with suggest context from README", async () => {
    const { result, exitCode } = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      showPrompt: true,
    });

    expect(exitCode).toBe(0);
    const r = result as { showPrompt: boolean; prompt: string };
    expect(r.showPrompt).toBe(true);
    expect(r.prompt).toContain("Suggestion Request");
    expect(r.prompt).toContain("Source: README");
  });

  it("show-prompt context includes source material", async () => {
    const { result } = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      showPrompt: true,
    });

    const r = result as { prompt: string };
    expect(r.prompt).toContain("Suggestion Request");
    expect(r.prompt).toContain("Source: README");
  });

  it("returns exit code 2 when no source is provided", async () => {
    const { exitCode } = await runSuggest({
      showPrompt: true,
    });

    expect(exitCode).toBe(2);
  });

  it("accepts --from-source option", async () => {
    const { result, exitCode } = await runSuggest({
      fromSource: resolve(FIXTURES, "../../src/cli.ts"),
      showPrompt: true,
    });

    expect(exitCode).toBe(0);
    const r = result as { prompt: string };
    expect(r.prompt).toContain("Source: CLI source code");
  });

  it("accepts multiple sources simultaneously", async () => {
    const { result, exitCode } = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      fromSource: resolve(FIXTURES, "../../src/cli.ts"),
      showPrompt: true,
    });

    expect(exitCode).toBe(0);
    const r = result as { prompt: string };
    expect(r.prompt).toContain("Source: README");
    expect(r.prompt).toContain("Source: CLI source code");
  });
});
