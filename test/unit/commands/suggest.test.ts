import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { runSuggest } from "../../../src/commands/suggest.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("suggest command", () => {
  it("returns show-prompt result with suggest context from README", async () => {
    const result = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      showPrompt: true,
    });

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Suggestion Request");
    expect(result as string).toContain("Source: README");
  });

  it("show-prompt context includes source material", async () => {
    const result = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      showPrompt: true,
    });

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Suggestion Request");
    expect(result as string).toContain("Source: README");
  });

  it("returns exit code 2 when no source is provided", async () => {
    const result = await runSuggest({
      showPrompt: true,
    });

    expect(typeof result).not.toBe("string");
    const { exitCode } = result as { result: unknown; exitCode: number };
    expect(exitCode).toBe(2);
  });

  it("accepts --from-source option", async () => {
    const result = await runSuggest({
      fromSource: resolve(FIXTURES, "../../src/cli.ts"),
      showPrompt: true,
    });

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Source: CLI source code");
  });

  it("accepts multiple sources simultaneously", async () => {
    const result = await runSuggest({
      fromReadme: resolve(FIXTURES, "../../README.md"),
      fromSource: resolve(FIXTURES, "../../src/cli.ts"),
      showPrompt: true,
    });

    expect(typeof result).toBe("string");
    expect(result as string).toContain("Source: README");
    expect(result as string).toContain("Source: CLI source code");
  });
});
