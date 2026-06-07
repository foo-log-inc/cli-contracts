import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  mergeCliContract,
  resolveContractFile,
  resolveContractString,
  ResolveError,
  MergeError,
} from "../../src/resolver/index.js";
import { parseContractFile } from "../../src/parser.js";
import { ParseError, parseContractString } from "../../src/parser.js";
import { validateContract } from "../../src/validator.js";
import { runDiff } from "../../src/commands/diff.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("mergeCliContract", () => {
  it("deep merges command_sets maps", () => {
    const base = {
      command_sets: {
        cli: {
          commands: {
            hello: { summary: "Hello" },
          },
        },
      },
    };
    const overlay = {
      extends: "base.yaml",
      command_sets: {
        cli: {
          commands: {
            hello: { summary: "Hello custom" },
            bye: { summary: "Bye" },
          },
        },
      },
    };
    const merged = mergeCliContract(base, overlay);
    expect(merged.command_sets.cli.commands.hello).toEqual({
      summary: "Hello custom",
    });
    expect(merged.command_sets.cli.commands.bye).toEqual({ summary: "Bye" });
    expect(merged).not.toHaveProperty("extends");
  });

  it("replaces scalar fields from overlay", () => {
    const base = { cli_contracts: "0.1.0", info: { title: "A", version: "1" } };
    const overlay = {
      extends: "base.yaml",
      cli_contracts: "0.2.0",
      info: { title: "B" },
    };
    const merged = mergeCliContract(base, overlay);
    expect(merged.cli_contracts).toBe("0.2.0");
    expect(merged.info).toEqual({ title: "B", version: "1" });
  });

  it("appends to arrays with $append operator", () => {
    const base = {
      command_sets: {
        cli: { global_options: [{ name: "help" }] },
      },
    };
    const overlay = {
      extends: "base.yaml",
      command_sets: {
        cli: {
          global_options: {
            $append: [{ name: "verbose" }],
          },
        },
      },
    };
    const merged = mergeCliContract(base, overlay);
    expect(merged.command_sets.cli.global_options).toEqual([
      { name: "help" },
      { name: "verbose" },
    ]);
  });

  it("replaces arrays with $replace operator", () => {
    const base = {
      command_sets: {
        cli: { global_options: [{ name: "help" }] },
      },
    };
    const overlay = {
      extends: "base.yaml",
      command_sets: {
        cli: {
          global_options: {
            $replace: [{ name: "verbose" }],
          },
        },
      },
    };
    const merged = mergeCliContract(base, overlay);
    expect(merged.command_sets.cli.global_options).toEqual([
      { name: "verbose" },
    ]);
  });

  it("rejects merge operators without extends", () => {
    const base = { command_sets: { cli: { global_options: [] } } };
    const overlay = {
      command_sets: {
        cli: {
          global_options: { $append: [{ name: "verbose" }] },
        },
      },
    };
    expect(() => mergeCliContract(base, overlay)).toThrow(MergeError);
  });
});

describe("resolveContractFile", () => {
  it("merges overlay onto base contract", async () => {
    const result = await resolveContractFile(
      resolve(FIXTURES, "overlay-contract.yaml"),
    );
    expect(result.document.info.title).toBe("Overlay CLI");
    expect(result.document.info.description).toBe(
      "Base contract for extends tests.",
    );
    expect(
      result.document.command_sets["base-cli"].commands.hello.summary,
    ).toBe("Say hello (customized).");
    expect(result.document.command_sets["base-cli"].commands).toHaveProperty(
      "goodbye",
    );
    expect(result.document.command_sets["base-cli"].commands).toHaveProperty(
      "greet",
    );
    expect(result.basePaths).toContain(
      resolve(FIXTURES, "base-contract.yaml"),
    );
  });

  it("supports chained extends", async () => {
    const result = await resolveContractFile(
      resolve(FIXTURES, "chain-overlay-contract.yaml"),
    );
    const cmds = result.document.command_sets["chain-cli"].commands;
    expect(cmds).toHaveProperty("root");
    expect(cmds).toHaveProperty("mid");
    expect(cmds).toHaveProperty("top");
    expect(result.document.info.title).toBe("Chain Overlay");
    expect(result.basePaths).toEqual([
      resolve(FIXTURES, "chain-base-contract.yaml"),
      resolve(FIXTURES, "chain-mid-contract.yaml"),
    ]);
  });

  it("appends global_options via $append", async () => {
    const result = await resolveContractFile(
      resolve(FIXTURES, "overlay-append-contract.yaml"),
    );
    expect(
      result.document.command_sets["base-cli"].global_options,
    ).toEqual([
      {
        name: "verbose",
        aliases: ["v"],
        description: "Enable verbose output.",
      },
    ]);
  });

  it("detects circular extends", async () => {
    await expect(
      resolveContractFile(resolve(FIXTURES, "circular-a-contract.yaml")),
    ).rejects.toThrow(ResolveError);
    await expect(
      resolveContractFile(resolve(FIXTURES, "circular-a-contract.yaml")),
    ).rejects.toThrow(/Circular extends/);
  });
});

describe("parseContractFile with extends", () => {
  it("returns resolved document", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "overlay-contract.yaml"),
    );
    expect(doc.command_sets["base-cli"].commands).toHaveProperty("greet");
    expect(doc.command_sets["base-cli"].commands).toHaveProperty("goodbye");
  });

  it("validates resolved contract", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "overlay-contract.yaml"),
    );
    const result = validateContract(doc, {
      basePath: FIXTURES,
    });
    expect(result.valid).toBe(true);
  });
});

describe("parseContractString with extends", () => {
  it("rejects documents with extends field", () => {
    expect(() =>
      parseContractString(
        `
extends: base.yaml
cli_contracts: 0.1.0
info:
  title: X
  version: 1.0.0
command_sets:
  x:
    commands:
      a:
        summary: A
        exits:
          '0':
            description: OK
`,
      ),
    ).toThrow(ParseError);
  });
});

describe("resolveContractString", () => {
  it("resolves inline overlay with file path context", async () => {
    const basePath = resolve(FIXTURES, "base-contract.yaml");
    const content = `
extends: ${basePath}
cli_contracts: 0.1.0
info:
  title: Inline Overlay
  version: 3.0.0
command_sets:
  base-cli:
    commands:
      extra:
        summary: Extra command.
        exits:
          '0':
            description: Success.
`;
    const result = await resolveContractString(content, basePath);
    expect(result.document.info.title).toBe("Inline Overlay");
    expect(result.document.command_sets["base-cli"].commands).toHaveProperty(
      "hello",
    );
    expect(result.document.command_sets["base-cli"].commands).toHaveProperty(
      "extra",
    );
  });
});

describe("runDiff with extends", () => {
  it("diffs resolved contracts", async () => {
    const result = await runDiff(
      resolve(FIXTURES, "base-contract.yaml"),
      resolve(FIXTURES, "overlay-contract.yaml"),
    );
    expect(result.changes.length).toBeGreaterThan(0);
    const added = result.changes.find(
      (c) => c.path.includes("/greet") && c.type === "added",
    );
    expect(added).toBeDefined();
  });
});
