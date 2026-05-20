import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../src/parser.js";
import { normalizeContract } from "../../src/normalizer.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("normalizeContract", () => {
  it("normalizes a contract into generator context", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);

    expect(ctx.spec_version).toBe("0.1.0");
    expect(ctx.info.title).toBe("Test CLI");
    expect(ctx.command_sets.length).toBe(2);
  });

  it("derives executable from command set key when not specified", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo-bar:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    expect(ctx.command_sets[0].executable).toBe("foo-bar");
  });

  it("uses explicit executable when specified", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  internal-name:
    executable: my-tool
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    expect(ctx.command_sets[0].executable).toBe("my-tool");
  });

  it("derives command path from ID by splitting on dots", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      users.import:
        summary: Import users.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const cmd = ctx.command_sets[0].commands[0];
    expect(cmd.path).toEqual(["users", "import"]);
    expect(cmd.invocation).toBe("foo users import");
  });

  it("uses explicit path override", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      legacy.user-import:
        path: [users, import]
        summary: Import users.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const cmd = ctx.command_sets[0].commands[0];
    expect(cmd.id).toBe("legacy.user-import");
    expect(cmd.path).toEqual(["users", "import"]);
    expect(cmd.invocation).toBe("foo users import");
  });

  it("computes fullId as commandSetId.commandId", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const cmd = ctx.command_sets[0].commands.find(
      (c) => c.id === "users.list",
    );
    expect(cmd?.full_id).toBe("test-cli.users.list");
  });

  it("sorts exit codes numerically", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      multi:
        summary: Multi exit.
        exits:
          '10':
            description: Partial.
          '0':
            description: Success.
          '2':
            description: Error.
`);
    const ctx = normalizeContract(doc);
    const exits = ctx.command_sets[0].commands[0].exits;
    expect(exits.map((e) => e.exit_code)).toEqual([0, 2, 10]);
  });

  it("includes global options in allOptions", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const cmd = ctx.command_sets[0].commands[0];
    expect(cmd.all_options.length).toBeGreaterThan(cmd.options.length);
    expect(cmd.all_options.some((o) => o.name === "verbose")).toBe(true);
  });

  it("extracts x- extension properties", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      hello:
        summary: Hello.
        x-agent:
          risk_level: high
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const cmd = ctx.command_sets[0].commands[0];
    expect(cmd.extensions["x-agent"]).toEqual({ risk_level: "high" });
  });
});
