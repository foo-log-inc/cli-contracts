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

    expect(ctx.specVersion).toBe("0.1.0");
    expect(ctx.info.title).toBe("Test CLI");
    expect(ctx.commandSets.length).toBe(2);
  });

  it("derives executable from command set key when not specified", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: T
  version: 0.1.0
commandSets:
  foo-bar:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    expect(ctx.commandSets[0].executable).toBe("foo-bar");
  });

  it("uses explicit executable when specified", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: T
  version: 0.1.0
commandSets:
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
    expect(ctx.commandSets[0].executable).toBe("my-tool");
  });

  it("derives command path from ID by splitting on dots", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: T
  version: 0.1.0
commandSets:
  foo:
    commands:
      users.import:
        summary: Import users.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const cmd = ctx.commandSets[0].commands[0];
    expect(cmd.path).toEqual(["users", "import"]);
    expect(cmd.invocation).toBe("foo users import");
  });

  it("uses explicit path override", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: T
  version: 0.1.0
commandSets:
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
    const cmd = ctx.commandSets[0].commands[0];
    expect(cmd.id).toBe("legacy.user-import");
    expect(cmd.path).toEqual(["users", "import"]);
    expect(cmd.invocation).toBe("foo users import");
  });

  it("computes fullId as commandSetId.commandId", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const cmd = ctx.commandSets[0].commands.find(
      (c) => c.id === "users.list",
    );
    expect(cmd?.fullId).toBe("test-cli.users.list");
  });

  it("sorts exit codes numerically", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: T
  version: 0.1.0
commandSets:
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
    const exits = ctx.commandSets[0].commands[0].exits;
    expect(exits.map((e) => e.exitCode)).toEqual([0, 2, 10]);
  });

  it("includes global options in allOptions", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const cmd = ctx.commandSets[0].commands[0];
    expect(cmd.allOptions.length).toBeGreaterThan(cmd.options.length);
    expect(cmd.allOptions.some((o) => o.name === "verbose")).toBe(true);
  });

  it("extracts x- extension properties", () => {
    const doc = parseContractString(`
cliContracts: 0.1.0
info:
  title: T
  version: 0.1.0
commandSets:
  x:
    commands:
      hello:
        summary: Hello.
        x-agent:
          riskLevel: high
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const cmd = ctx.commandSets[0].commands[0];
    expect(cmd.extensions["x-agent"]).toEqual({ riskLevel: "high" });
  });
});
