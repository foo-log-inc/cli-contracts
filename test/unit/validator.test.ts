import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../src/parser.js";
import { validateContract } from "../../src/validator.js";
import { normalizeContract } from "../../src/normalizer.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

describe("validateContract", () => {
  it("validates a correct contract without errors", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it("validates a minimal contract without errors", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "minimal-contract.yaml"),
    );
    const result = validateContract(doc);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  // ── Structural checks (now caught by Zod at parse time) ─────

  it("rejects missing info.title at parse time", () => {
    expect(() =>
      parseContractString(`
cli_contracts: 0.1.0
info:
  title: ""
  version: 1.0.0
command_sets:
  x:
    commands:
      hello:
        summary: Hello.
        exits:
          '0':
            description: OK.
`),
    ).toThrow(/info\.title/);
  });

  it("rejects missing command summary at parse time", () => {
    expect(() =>
      parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets:
  x:
    commands:
      broken:
        exits:
          '0':
            description: OK.
`),
    ).toThrow(/summary/);
  });

  it("rejects empty commandSets at parse time", () => {
    expect(() =>
      parseContractString(`
cli_contracts: 0.1.0
info:
  title: Test
  version: 1.0.0
command_sets: {}
`),
    ).toThrow(/At least one command set/);
  });

  // ── Semantic checks (validator) ─────────────────────────────

  it("detects duplicate command paths", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const dupPath = result.errors.filter((e) => e.rule === "duplicate-command-path");
    expect(dupPath.length).toBeGreaterThan(0);
  });

  it("detects invalid exit codes (>255)", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const invalidExit = result.errors.filter(
      (e) => e.rule === "invalid-exit-code",
    );
    expect(invalidExit.length).toBeGreaterThan(0);
  });

  it("detects duplicate option names", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const dupOpt = result.errors.filter(
      (e) => e.rule === "duplicate-option-name",
    );
    expect(dupOpt.length).toBeGreaterThan(0);
  });

  it("detects duplicate option aliases", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const dupAlias = result.errors.filter(
      (e) => e.rule === "duplicate-option-alias",
    );
    expect(dupAlias.length).toBeGreaterThan(0);
  });

  it("detects variadic argument not last", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const variadicErr = result.errors.filter(
      (e) => e.rule === "variadic-not-last",
    );
    expect(variadicErr.length).toBeGreaterThan(0);
  });

  it("detects unresolved $ref", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "invalid-contract.yaml"),
    );
    const result = validateContract(doc);
    const unresolved = result.errors.filter(
      (e) => e.rule === "unresolved-ref",
    );
    expect(unresolved.length).toBeGreaterThan(0);
  });

  it("warns on stream schema conflict", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: Stream Test
  version: 0.1.0
command_sets:
  x:
    commands:
      filter:
        summary: Filter.
        streams:
          stdin:
            required: true
            format: ndjson
            framing:
              type: line-delimited
            schema:
              type: object
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const streamWarn = result.warnings.filter(
      (w) => w.rule === "stream-schema-conflict",
    );
    expect(streamWarn.length).toBeGreaterThan(0);
  });

  it("accepts a groups entry that matches a real command prefix", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      components.build:
        summary: Build components.
        exits:
          '0':
            description: OK.
    groups:
      components:
        description: Manage components.
`);
    const result = validateContract(doc);
    expect(
      result.warnings.filter((w) => w.rule === "orphan-group"),
    ).toHaveLength(0);
  });

  it("warns on a typo'd (unknown non-x-) key on a command, naming key and path", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        descriptio: Typo of description.
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const unknown = result.warnings.filter((w) => w.rule === "unknown-key");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].severity).toBe("warning");
    expect(unknown[0].message).toContain("descriptio");
    // Near-miss hint via Levenshtein.
    expect(unknown[0].message).toContain("description");
    expect(unknown[0].path).toBe("/command_sets/tool/commands/build/descriptio");
  });

  it("warns on an unknown key on a command set", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    executabl: tool
    commands:
      build:
        summary: Build.
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const unknown = result.warnings.filter((w) => w.rule === "unknown-key");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].message).toContain("executabl");
    expect(unknown[0].path).toBe("/command_sets/tool/executabl");
  });

  it("does not flag x--prefixed extension keys", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    x-set-ext: allowed
    commands:
      build:
        summary: Build.
        x-agent:
          risk_level: low
        x-custom:
          anything: goes
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    expect(result.warnings.filter((w) => w.rule === "unknown-key")).toHaveLength(0);
  });

  it("does not flag any known field on a fully-populated command / command set", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    executable: tool
    summary: A tool.
    description: A full tool.
    global_options:
      - name: verbose
    env:
      TOKEN:
        description: A token.
    groups:
      grp:
        description: A group.
    commands:
      grp.build:
        path: [grp, build]
        summary: Build.
        description: Builds things.
        usage: ["tool grp build"]
        arguments:
          - name: target
        options:
          - name: force
        effects:
          risk_level: low
        constraints:
          mutuallyExclusive: [[force, target]]
          requiredOneOf: [force, target]
        streams:
          stdout:
            format: text
        signals:
          SIGINT:
            description: Interrupt.
        examples:
          - command: tool grp build
        deprecated:
          since: "1.0.0"
          message: none
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    expect(result.warnings.filter((w) => w.rule === "unknown-key")).toHaveLength(0);
  });

  it("treats a valid constraints block as a known field and round-trips it", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        constraints:
          mutuallyExclusive: [[contract, file]]
          requiredOneOf: [from-readme, from-help]
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    // constraints is now a first-class field, not an unknown key.
    expect(result.warnings.filter((w) => w.rule === "unknown-key")).toHaveLength(0);

    // It is carried through normalization as a real field (not via extensions).
    const ctx = normalizeContract(doc);
    const cmd = ctx.command_sets[0].commands[0];
    expect(cmd.constraints).toEqual({
      mutuallyExclusive: [["contract", "file"]],
      requiredOneOf: ["from-readme", "from-help"],
    });
    expect(cmd.extensions).toEqual({});
  });

  it("emits no unknown-key warnings for the repository's own contract", async () => {
    const doc = await parseContractFile(
      resolve(import.meta.dirname, "../../cli-contract.yaml"),
    );
    const result = validateContract(doc);
    expect(result.warnings.filter((w) => w.rule === "unknown-key")).toHaveLength(0);
  });

  // ── Unknown-key on arguments / options / exits (#83) ────────

  it("warns on a typo'd (unknown non-x-) key on an argument, naming key and path", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        arguments:
          - name: target
            descriptn: Typo of description.
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const unknown = result.warnings.filter((w) => w.rule === "unknown-key");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].severity).toBe("warning");
    expect(unknown[0].message).toContain("descriptn");
    // Near-miss hint via Levenshtein.
    expect(unknown[0].message).toContain("description");
    expect(unknown[0].path).toBe(
      "/command_sets/tool/commands/build/arguments/0/descriptn",
    );
  });

  it("warns on a typo'd (unknown non-x-) key on an option, naming key and path", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        options:
          - name: force
            descriptn: Typo of description.
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const unknown = result.warnings.filter((w) => w.rule === "unknown-key");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].severity).toBe("warning");
    expect(unknown[0].message).toContain("descriptn");
    expect(unknown[0].message).toContain("description");
    expect(unknown[0].path).toBe(
      "/command_sets/tool/commands/build/options/0/descriptn",
    );
  });

  it("warns on a typo'd (unknown non-x-) key on a command-set global option, naming key and path", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    global_options:
      - name: verbose
        descriptn: Typo of description.
    commands:
      build:
        summary: Build.
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const unknown = result.warnings.filter((w) => w.rule === "unknown-key");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].path).toBe(
      "/command_sets/tool/global_options/0/descriptn",
    );
  });

  it("warns on a typo'd (unknown non-x-) key on an exit, naming key and path", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        exits:
          '0':
            description: OK.
            descriptn: Typo of description.
`);
    const result = validateContract(doc);
    const unknown = result.warnings.filter((w) => w.rule === "unknown-key");
    expect(unknown).toHaveLength(1);
    expect(unknown[0].severity).toBe("warning");
    expect(unknown[0].message).toContain("descriptn");
    expect(unknown[0].message).toContain("description");
    expect(unknown[0].path).toBe(
      "/command_sets/tool/commands/build/exits/0/descriptn",
    );
  });

  it("does not flag x--prefixed extension keys on arguments / options / exits", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        arguments:
          - name: target
            x-arg-ext: allowed
        options:
          - name: force
            x-opt-ext: allowed
        exits:
          '0':
            description: OK.
            x-exit-ext: allowed
`);
    const result = validateContract(doc);
    expect(result.warnings.filter((w) => w.rule === "unknown-key")).toHaveLength(0);
  });

  it("does not flag known fields on fully-populated arguments / options / exits", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        arguments:
          - name: target
            index: 0
            required: true
            description: The build target.
            variadic: false
        options:
          - name: force
            aliases: [f]
            required: false
            value_name: FORCE
            description: Force the build.
            repeatable: false
        exits:
          '0':
            description: OK.
            stdout:
              format: text
`);
    const result = validateContract(doc);
    expect(result.warnings.filter((w) => w.rule === "unknown-key")).toHaveLength(0);
  });

  it("does not leak unknown / x- keys from arguments or options into normalized output", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    global_options:
      - name: verbose
        x-glob: kept-in-yaml-only
    commands:
      build:
        summary: Build.
        arguments:
          - name: target
            descriptn: typo
            x-arg-ext: ext
        options:
          - name: force
            descriptn: typo
            x-opt-ext: ext
        exits:
          '0':
            description: OK.
`);
    const ctx = normalizeContract(doc);
    const cmd = ctx.command_sets[0].commands[0];
    expect(cmd.arguments[0]).toEqual({ name: "target" });
    expect(cmd.options[0]).toEqual({ name: "force" });
    expect(cmd.all_options).toEqual([{ name: "verbose" }, { name: "force" }]);
    expect(ctx.command_sets[0].global_options[0]).toEqual({ name: "verbose" });
  });

  // ── Constraints reference-integrity (#81) ───────────────────

  it("accepts a constraints block whose names all reference real options/arguments", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        arguments:
          - name: target
        options:
          - name: json
          - name: yaml
        constraints:
          mutuallyExclusive: [[json, yaml]]
          requiredOneOf: [json, yaml, target]
          requiredTogether: [[json, target]]
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    expect(
      result.errors.filter((e) => e.rule === "constraint-unknown-reference"),
    ).toHaveLength(0);
  });

  it("errors when mutuallyExclusive references an unknown name", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        options:
          - name: json
        constraints:
          mutuallyExclusive: [[json, yaml]]
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const errs = result.errors.filter(
      (e) => e.rule === "constraint-unknown-reference",
    );
    expect(errs).toHaveLength(1);
    expect(errs[0].severity).toBe("error");
    expect(errs[0].message).toContain("yaml");
    expect(errs[0].path).toBe(
      "/command_sets/tool/commands/build/constraints/mutuallyExclusive/0/1",
    );
  });

  it("errors when requiredOneOf references an unknown name", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        options:
          - name: json
        constraints:
          requiredOneOf: [json, nope]
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const errs = result.errors.filter(
      (e) => e.rule === "constraint-unknown-reference",
    );
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain("nope");
    expect(errs[0].path).toBe(
      "/command_sets/tool/commands/build/constraints/requiredOneOf/1",
    );
  });

  it("errors when requiredTogether references an unknown name", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        options:
          - name: cert
        constraints:
          requiredTogether: [[cert, key]]
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const errs = result.errors.filter(
      (e) => e.rule === "constraint-unknown-reference",
    );
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain("key");
    expect(errs[0].path).toBe(
      "/command_sets/tool/commands/build/constraints/requiredTogether/0/1",
    );
  });

  it("errors when a constraint references an unknown argument name", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      build:
        summary: Build.
        arguments:
          - name: target
        constraints:
          requiredOneOf: [target, ghost]
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    const errs = result.errors.filter(
      (e) => e.rule === "constraint-unknown-reference",
    );
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toContain("ghost");
  });

  it("resolves constraint references against option aliases and global options", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    global_options:
      - name: verbose
    commands:
      build:
        summary: Build.
        options:
          - name: json
            aliases: [j]
        constraints:
          mutuallyExclusive: [[j, verbose]]
        exits:
          '0':
            description: OK.
`);
    const result = validateContract(doc);
    expect(
      result.errors.filter((e) => e.rule === "constraint-unknown-reference"),
    ).toHaveLength(0);
  });

  it("warns when a groups entry references a path with no commands under it", () => {
    const doc = parseContractString(`
cli_contracts: 0.1.0
info:
  title: T
  version: 1.0.0
command_sets:
  tool:
    commands:
      components.build:
        summary: Build components.
        exits:
          '0':
            description: OK.
    groups:
      nonexistent:
        description: Nothing here.
`);
    const result = validateContract(doc);
    const orphan = result.warnings.filter((w) => w.rule === "orphan-group");
    expect(orphan).toHaveLength(1);
    expect(orphan[0].message).toContain("nonexistent");
  });
});
