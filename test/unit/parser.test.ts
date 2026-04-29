import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  parseContractFile,
  parseContractString,
  parseConfigString,
  ParseError,
} from "../../src/parser.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("parseContractFile", () => {
  it("parses a valid contract file", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    expect(doc.cliContracts).toBe("0.1.0");
    expect(doc.info.title).toBe("Test CLI");
    expect(doc.info.version).toBe("1.0.0");
    expect(doc.commandSets).toHaveProperty("test-cli");
    expect(doc.commandSets["test-cli"].commands).toHaveProperty("users.list");
    expect(doc.commandSets["test-cli"].commands).toHaveProperty("users.import");
  });

  it("parses a minimal contract file", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "minimal-contract.yaml"),
    );
    expect(doc.cliContracts).toBe("0.1.0");
    expect(doc.commandSets.minimal.commands.hello.summary).toBe("Say hello.");
  });

  it("throws ParseError for non-existent file", async () => {
    await expect(
      parseContractFile(resolve(FIXTURES, "nonexistent.yaml")),
    ).rejects.toThrow(ParseError);
  });
});

describe("parseContractString", () => {
  it("parses valid YAML string", () => {
    const yaml = `
cliContracts: 0.1.0
info:
  title: Inline CLI
  version: 0.1.0
commandSets:
  inline:
    commands:
      hello:
        summary: Say hello.
        exits:
          '0':
            description: Success.
`;
    const doc = parseContractString(yaml);
    expect(doc.cliContracts).toBe("0.1.0");
    expect(doc.info.title).toBe("Inline CLI");
    expect(doc.commandSets.inline.commands.hello.summary).toBe("Say hello.");
  });

  it("throws on missing cliContracts field", () => {
    const yaml = `
info:
  title: Bad
  version: 0.1.0
commandSets: {}
`;
    expect(() => parseContractString(yaml)).toThrow("cliContracts");
  });

  it("throws on missing info field", () => {
    const yaml = `
cliContracts: 0.1.0
commandSets: {}
`;
    expect(() => parseContractString(yaml)).toThrow("info");
  });

  it("throws on missing commandSets", () => {
    const yaml = `
cliContracts: 0.1.0
info:
  title: X
  version: 0.1.0
`;
    expect(() => parseContractString(yaml)).toThrow("commandSets");
  });

  it("throws on invalid YAML", () => {
    expect(() => parseContractString("{{{{")).toThrow(ParseError);
  });

  it("throws on non-object YAML", () => {
    expect(() => parseContractString("just a string")).toThrow(ParseError);
  });
});

describe("parseConfigString", () => {
  it("parses valid config YAML", () => {
    const yaml = `
version: 0.1.0
input:
  files:
    - cli-contract.yaml
generators:
  markdown:
    enabled: true
    output: ./docs/cli.md
    templates: builtin:markdown
`;
    const config = parseConfigString(yaml);
    expect(config.version).toBe("0.1.0");
    expect(config.input?.files).toEqual(["cli-contract.yaml"]);
    expect(config.generators?.markdown?.enabled).toBe(true);
  });
});
