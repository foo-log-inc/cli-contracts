import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../../src/parser.js";
import { normalizeContract } from "../../../src/normalizer.js";
import { generateMarkdown } from "../../../src/generators/markdown.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("generateMarkdown", () => {
  it("generates markdown from a valid contract", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("# Test CLI");
    expect(md).toContain("## test-cli");
    expect(md).toContain("### users.list");
    expect(md).toContain("### users.import");
    expect(md).toContain("### logs.filter");
    expect(md).toContain("## test-admin");
    expect(md).toContain("### tenants.create");
  });

  it("includes table of contents", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx, { includeToc: true });

    expect(md).toContain("## Table of Contents");
    expect(md).toContain("- [test-cli]");
    expect(md).toContain("- [test-admin]");
  });

  it("renders arguments table", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("#### Arguments");
    expect(md).toContain("| `input`");
    expect(md).toContain("| Yes |");
  });

  it("renders options table", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("#### Options");
    expect(md).toContain("| `--format`");
    expect(md).toContain("| `--dry-run`");
  });

  it("renders exit codes", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("#### Exit Codes");
    expect(md).toContain("**Exit 0:**");
    expect(md).toContain("**Exit 2:**");
    expect(md).toContain("**Exit 10:**");
  });

  it("renders global options", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("### Global Options");
    expect(md).toContain("| `--verbose`");
  });

  it("renders stream information", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("#### Streams");
    expect(md).toContain("Format: `ndjson`");
    expect(md).toContain("Framing: `line-delimited`");
  });

  it("renders signal information", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("#### Signals");
    expect(md).toContain("| `SIGINT`");
    expect(md).toContain("| `SIGTERM`");
  });

  it("renders x-agent extensions when enabled", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx, { includeExtensions: true });

    expect(md).toContain("#### Extensions");
    expect(md).toContain("risk_level: high");
  });

  it("renders schemas section when enabled", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx, { includeSchemas: true });

    expect(md).toContain("## Schemas");
    expect(md).toContain("### UserList");
    expect(md).toContain("### ImportResult");
    expect(md).toContain("### Error");
  });

  it("renders usage lines", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("test-cli users import <input> [--dry-run]");
  });

  it("auto-generates usage when not explicit", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  foo:
    commands:
      bar:
        summary: Bar.
        arguments:
          - name: input
            required: true
            schema:
              type: string
        options:
          - name: output
            schema:
              type: string
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("foo bar <input> [--output]");
  });

  // ── Schema table rendering ─────────────────────────────
  it("renders inline schema as property table instead of raw JSON", () => {
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
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                type: object
                required: [status, count]
                properties:
                  status:
                    type: string
                    description: Result status.
                  count:
                    type: integer
                    minimum: 0
                    description: Number of items.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("| Property | Type | Required | Description |");
    expect(md).toContain("| `status` | `string` | Yes | Result status. |");
    expect(md).toContain("| `count` | `integer (min: 0)` | Yes | Number of items. |");
  });

  it("renders nested object properties with dot notation", () => {
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
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                type: object
                required: [meta]
                properties:
                  meta:
                    type: object
                    required: [version]
                    properties:
                      version:
                        type: string
                        description: API version.
                      region:
                        type: string
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("| `meta` | `object` | Yes |");
    expect(md).toContain("| `meta.version` | `string` | Yes | API version. |");
    expect(md).toContain("| `meta.region` | `string` | No |");
  });

  it("renders array of objects with [] notation", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      list:
        summary: List.
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                type: object
                required: [items]
                properties:
                  items:
                    type: array
                    items:
                      type: object
                      required: [id, name]
                      properties:
                        id:
                          type: string
                        name:
                          type: string
                          description: Display name.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("| `items` | `object[]` | Yes |");
    expect(md).toContain("| `items[].id` | `string` | Yes |");
    expect(md).toContain("| `items[].name` | `string` | Yes | Display name. |");
  });

  it("wraps full JSON Schema in <details> tag", () => {
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
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                type: object
                required: [ok]
                properties:
                  ok:
                    type: boolean
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("<details>");
    expect(md).toContain("<summary>JSON Schema</summary>");
    expect(md).toContain('"type": "object"');
    expect(md).toContain("</details>");
  });

  it("renders $ref schemas as links to schema section", () => {
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
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/MyResult'
components:
  schemas:
    MyResult:
      type: object
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("[`MyResult`](#myresult)");
  });

  it("renders component schemas as tables with details", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx, { includeSchemas: true });

    expect(md).toContain("### UserList");
    expect(md).toContain("| `users` |");
    expect(md).toContain("| `total` |");
    expect(md).toContain("<details>");
    expect(md).toContain("<summary>JSON Schema</summary>");
  });

  // ── yamlLike nested-array rendering (via Extensions) ────
  it("renders array-of-arrays in the yaml-like block without malformed output", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      run:
        summary: Run.
        x-groups:
          pairs: [[a, b], [c, d]]
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx, { includeExtensions: true });

    // The malformed form that the old yamlLike produced must NOT appear:
    // a nested list item glued onto the same line as its parent "-".
    expect(md).not.toMatch(/-[ \t]+- a/);

    // A nested list item begins on its own line, indented under its parent "-".
    const block = md.slice(md.indexOf("#### Extensions"));
    expect(block).toContain("pairs:");
    // parent list marker on its own line, children indented beneath it
    expect(block).toContain("    -\n      - a\n      - b");
    expect(block).toContain("    -\n      - c\n      - d");
  });

  it("renders a scalar array in the yaml-like block as a simple list", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      run:
        summary: Run.
        x-groups:
          tags: [alpha, beta]
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx, { includeExtensions: true });

    const block = md.slice(md.indexOf("#### Extensions"));
    expect(block).toContain("tags:");
    expect(block).toContain("- alpha");
    expect(block).toContain("- beta");
  });

  // ── Constraints rendering ──────────────────────────────
  it("renders a Constraints section with mutuallyExclusive / requiredOneOf / requiredTogether", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      run:
        summary: Run.
        arguments:
          - name: contract
            index: 0
            schema:
              type: string
        options:
          - name: file
            schema:
              type: string
          - name: json
            schema:
              type: boolean
          - name: yaml
            schema:
              type: boolean
          - name: user
            schema:
              type: string
          - name: token
            schema:
              type: string
        constraints:
          mutuallyExclusive: [[contract, file], [json, yaml]]
          requiredOneOf: [json, yaml]
          requiredTogether: [[user, token]]
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain("#### Constraints");
    expect(md).toContain("| Rule | Members |");
    // one row per mutuallyExclusive group
    expect(md).toContain("| Mutually exclusive | `contract`, `file` |");
    expect(md).toContain("| Mutually exclusive | `json`, `yaml` |");
    expect(md).toContain("| Required one of | `json`, `yaml` |");
    expect(md).toContain("| Required together | `user`, `token` |");
  });

  it("omits the Constraints section when a command has no constraints", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      run:
        summary: Run.
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).not.toContain("#### Constraints");
  });

  it("omits the Constraints section when constraints is present but empty", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 0.1.0
command_sets:
  x:
    commands:
      run:
        summary: Run.
        constraints: {}
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).not.toContain("#### Constraints");
  });

  it("renders enum types in property table", () => {
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
        exits:
          '0':
            description: OK.
            stdout:
              format: json
              schema:
                type: object
                required: [status]
                properties:
                  status:
                    type: string
                    enum: [active, inactive]
`);
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    expect(md).toContain('"active"');
    expect(md).toContain('"inactive"');
  });
});
