import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runContractTests } from "../../../src/commands/test.js";

const CONTRACT = `cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  tool:
    global_options:
      - name: color
        schema:
          type: boolean
          default: true
    commands:
      build:
        summary: Build.
        options:
          - name: manifest
            schema:
              type: boolean
              default: true
          - name: dry-run
            schema:
              type: boolean
              default: false
          - name: out-dir
            schema:
              type: string
        exits:
          '0':
            description: OK.
`;

// A second contract file: an LLM-powered command (it has `adapter`) with effects.
const ASSIST_CONTRACT = `cli_contracts: 0.1.0
info:
  title: Assist
  version: 0.1.0
command_sets:
  assist:
    commands:
      review:
        summary: Review.
        options:
          - name: adapter
            schema:
              type: string
        effects:
          network: true
        exits:
          '0':
            description: OK.
`;

describe("runContractTests", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cli-contracts-runner-"));
    await mkdir(join(dir, "cases"));
    await writeFile(join(dir, "cli-contract.yaml"), CONTRACT, "utf-8");
    await writeFile(join(dir, "assist-contract.yaml"), ASSIST_CONTRACT, "utf-8");
    // The CLI under test prints the argv the runner hands it.
    await writeFile(join(dir, "argv.mjs"), "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n", "utf-8");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const run = (caseId: string) => {
    const argv = { command: `${process.execPath} ${join(dir, "argv.mjs")}` };
    return runContractTests([join(dir, "cli-contract.yaml"), join(dir, "assist-contract.yaml")], {
      casesDir: join(dir, "cases"),
      caseIds: [caseId],
      executionProfiles: { local: { command_sets: { tool: argv, assist: argv } } },
    });
  };

  it("spells each option as the contract declares it, false for a default-true boolean as --no-<name>", async () => {
    await writeFile(join(dir, "cases", "spelled.yaml"), `id: spelled
commandSet: tool
command: build
options:
  manifest: false
  color: false
  dry-run: true
  out-dir: d
expect:
  exitCode: 0
  stdout:
    contains: '["build","--no-manifest","--no-color","--dry-run","--out-dir","d"]'
`, "utf-8");

    const result = await run("spelled");

    expect(result.cases).toEqual([expect.objectContaining({ id: "spelled", status: "passed" })]);
  }, 30000);

  it("finds a case's command set in any of the contract files", async () => {
    await writeFile(join(dir, "cases", "second-file.yaml"), `id: second-file
commandSet: assist
command: review
options:
  adapter: mock
expect:
  exitCode: 0
  stdout:
    contains: '["review","--adapter","mock"]'
`, "utf-8");

    const result = await run("second-file");

    expect(result.cases).toEqual([expect.objectContaining({ id: "second-file", status: "passed" })]);
  }, 30000);

  it("spells the options the generated program adds to the contract's", async () => {
    await writeFile(join(dir, "cases", "show-prompt.yaml"), `id: show-prompt
commandSet: assist
command: review
options:
  show-prompt: true
  introspect: true
expect:
  exitCode: 0
  stdout:
    contains: '["review","--show-prompt","--introspect"]'
`, "utf-8");
    await writeFile(join(dir, "cases", "extract.yaml"), `id: extract
commandSet: assist
command: extract
options:
  all: true
  include-meta: false
expect:
  exitCode: 0
  stdout:
    contains: '["extract","--all","--no-include-meta"]'
`, "utf-8");

    expect((await run("show-prompt")).cases).toEqual([expect.objectContaining({ status: "passed" })]);
    expect((await run("extract")).cases).toEqual([expect.objectContaining({ status: "passed" })]);
  }, 30000);

  it("rejects a case whose option the contract does not declare", async () => {
    await writeFile(join(dir, "cases", "undeclared.yaml"), `id: undeclared
commandSet: tool
command: build
options:
  manifets: false
expect:
  exitCode: 0
`, "utf-8");

    await expect(run("undeclared")).rejects.toThrow(
      'Test case "undeclared": option "manifets" is not declared for tool.build',
    );
  });
});
