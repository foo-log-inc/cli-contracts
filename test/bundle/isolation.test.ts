import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BUNDLE_PATH = join(__dirname, "..", "..", "dist", "cli-contracts.bundle.mjs");
const CONTRACT_PATH = join(__dirname, "..", "..", "cli-contract.yaml");

describe("bundle-isolation", () => {
  let tempDir: string;

  beforeAll(() => {
    if (!existsSync(BUNDLE_PATH)) {
      execSync("node esbuild.bundle.mjs", { cwd: join(__dirname, "..", "..") });
    }

    tempDir = mkdtempSync(join(tmpdir(), "cli-contracts-test-"));
    cpSync(BUNDLE_PATH, join(tempDir, "cli-contracts.bundle.mjs"));
    if (existsSync(CONTRACT_PATH)) {
      cpSync(CONTRACT_PATH, join(tempDir, "cli-contract.yaml"));
    }

    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "bundle-test", version: "1.0.0", type: "module" }),
    );

    execSync("npm install @openai/agents agent-contracts --legacy-peer-deps", {
      cwd: tempDir,
      stdio: "pipe",
    });
  }, 60_000);

  afterAll(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("starts without agent-contracts-runtime installed globally", () => {
    const output = execFileSync("node", ["cli-contracts.bundle.mjs", "--version"], {
      cwd: tempDir,
      encoding: "utf8",
    });
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("runs LLM audit with openai adapter from isolated directory", () => {
    if (!process.env.OPENAI_API_KEY) {
      return;
    }

    const output = execFileSync(
      "node",
      ["cli-contracts.bundle.mjs", "audit", "--adapter", "openai", "cli-contract.yaml"],
      {
        cwd: tempDir,
        encoding: "utf8",
        timeout: 60_000,
        env: { ...process.env, NODE_ENV: "test" },
      },
    );
    expect(output).toBeTruthy();
    expect(output).toContain("summary");
  }, 60_000);

  it("constructs prompt without SDK (--show-prompt)", () => {
    const output = execFileSync(
      "node",
      ["cli-contracts.bundle.mjs", "audit", "--adapter", "openai", "--show-prompt", "cli-contract.yaml"],
      {
        cwd: tempDir,
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(output).toBeTruthy();
    expect(output.length).toBeGreaterThan(100);
  }, 30_000);
});
