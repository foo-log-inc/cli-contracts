import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const execFileAsync = promisify(execFile);
const CLI = resolve(import.meta.dirname, "../../dist/cli.js");
const FIXTURES = resolve(import.meta.dirname, "../fixtures");

async function runCli(
  args: string[],
  { format = "json" }: { format?: "json" | "yaml" } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const fullArgs = format ? ["--format", format, ...args] : args;
  try {
    const result = await execFileAsync("node", [CLI, ...fullArgs], {
      timeout: 15000,
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: typeof e.code === "number" ? e.code : 1,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    };
  }
}

describe("CLI integration", () => {
  // ── version ────────────────────────────────────────────
  it("prints version with --version", async () => {
    const { stdout } = await runCli(["--version"]);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // ── init ───────────────────────────────────────────────
  describe("init", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "cli-contracts-test-"));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("creates a contract file", async () => {
      const { exitCode, stdout } = await runCli([
        "init",
        "--name",
        "foo",
        "--output",
        tmpDir,
      ]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.contractFile).toContain("cli-contract.yaml");

      const contractPath = join(tmpDir, "cli-contract.yaml");
      await access(contractPath);
      const content = await readFile(contractPath, "utf-8");
      expect(content).toContain("cliContracts");
      expect(content).toContain("foo");
    });

    it("creates contract + config with --with-config", async () => {
      const { exitCode, stdout } = await runCli([
        "init",
        "--name",
        "bar",
        "--output",
        tmpDir,
        "--with-config",
      ]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.configFile).toContain("cli-contracts.config.yaml");

      await access(join(tmpDir, "cli-contracts.config.yaml"));
    });

    it("creates multiple command sets with --multi-command-set", async () => {
      const { exitCode, stdout } = await runCli([
        "init",
        "--name",
        "multi",
        "--multi-command-set",
        "--output",
        tmpDir,
      ]);
      expect(exitCode).toBe(0);

      const content = await readFile(
        join(tmpDir, "cli-contract.yaml"),
        "utf-8",
      );
      expect(content).toContain("multi");
      expect(content).toContain("multi-admin");
    });

    it("exits 4 when file already exists", async () => {
      await runCli(["init", "--output", tmpDir]);
      const { exitCode, stderr } = await runCli([
        "init",
        "--output",
        tmpDir,
      ]);
      expect(exitCode).toBe(4);
      const error = JSON.parse(stderr);
      expect(error.code).toBe("FILE_EXISTS");
    });
  });

  // ── validate ───────────────────────────────────────────
  describe("validate", () => {
    it("validates a valid contract (exit 0)", async () => {
      const { exitCode, stdout } = await runCli([
        "validate",
        "-f",
        resolve(FIXTURES, "valid-contract.yaml"),
      ]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it("detects errors in invalid contract (exit 9)", async () => {
      const { exitCode, stdout } = await runCli([
        "validate",
        "-f",
        resolve(FIXTURES, "invalid-contract.yaml"),
      ]);
      expect(exitCode).toBe(9);
      const result = JSON.parse(stdout);
      expect(result.valid).toBe(false);
      expect(result.errorCount).toBeGreaterThan(0);
    });
  });

  // ── docs ───────────────────────────────────────────────
  describe("docs", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "cli-contracts-docs-"));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("generates markdown documentation", async () => {
      const outputPath = join(tmpDir, "cli-reference.md");
      const { exitCode } = await runCli([
        "docs",
        "-f",
        resolve(FIXTURES, "valid-contract.yaml"),
        "-o",
        outputPath,
      ]);
      expect(exitCode).toBe(0);

      const md = await readFile(outputPath, "utf-8");
      expect(md).toContain("# Test CLI");
      expect(md).toContain("## test-cli");
      expect(md).toContain("### users.list");
      expect(md).toContain("### users.import");
    });
  });

  // ── diff ───────────────────────────────────────────────
  describe("diff", () => {
    it("reports no breaking changes for identical files (exit 0)", async () => {
      const f = resolve(FIXTURES, "valid-contract.yaml");
      const { exitCode, stdout } = await runCli(["diff", f, f]);
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.hasBreakingChanges).toBe(false);
    });

    it("reports breaking changes when commands are removed (exit 7)", async () => {
      const { exitCode, stdout } = await runCli([
        "diff",
        resolve(FIXTURES, "valid-contract.yaml"),
        resolve(FIXTURES, "minimal-contract.yaml"),
      ]);
      expect(exitCode).toBe(7);
      const result = JSON.parse(stdout);
      expect(result.hasBreakingChanges).toBe(true);
      expect(result.breakingCount).toBeGreaterThan(0);
    });
  });
});
