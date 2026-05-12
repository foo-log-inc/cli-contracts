import { describe, it, expect } from "vitest";
import {
  derivePolicy,
  isOptionActive,
  buildIntrospection,
} from "../../src/policy.js";
import type { PolicyDerivationInput, OptionInput } from "../../src/policy.js";
import type { Option, Effects, Command } from "../../src/schema.js";

function makeOption(overrides: Partial<Option> & { name: string }): Option {
  return { name: overrides.name, ...overrides } as Option;
}

function makeInput(
  optName: string,
  definition: Option,
  value: unknown,
  specified: boolean,
): PolicyDerivationInput["options"] {
  return { [optName]: { value, specified, definition } };
}

describe("isOptionActive", () => {
  it("boolean option: active when value === true", () => {
    const def = makeOption({ name: "fix", schema: { type: "boolean" } });
    expect(isOptionActive(def, true, true)).toBe(true);
    expect(isOptionActive(def, false, true)).toBe(false);
    expect(isOptionActive(def, false, false)).toBe(false);
  });

  it("boolean option with default: true is active without explicit specification", () => {
    const def = makeOption({
      name: "color",
      schema: { type: "boolean", default: true },
    });
    expect(isOptionActive(def, true, false)).toBe(true);
  });

  it("string option: active when specified and non-null", () => {
    const def = makeOption({ name: "format", schema: { type: "string" } });
    expect(isOptionActive(def, "json", true)).toBe(true);
    expect(isOptionActive(def, null, true)).toBe(false);
    expect(isOptionActive(def, "json", false)).toBe(false);
  });

  it("number option: active when specified and non-null", () => {
    const def = makeOption({ name: "limit", schema: { type: "integer" } });
    expect(isOptionActive(def, 10, true)).toBe(true);
    expect(isOptionActive(def, 0, true)).toBe(true);
    expect(isOptionActive(def, null, true)).toBe(false);
  });

  it("repeatable option: active when specified and has items", () => {
    const def = makeOption({
      name: "include",
      schema: { type: "string" },
      repeatable: true,
    });
    expect(isOptionActive(def, ["a", "b"], true)).toBe(true);
    expect(isOptionActive(def, [], true)).toBe(false);
    expect(isOptionActive(def, ["a"], false)).toBe(false);
  });
});

describe("derivePolicy", () => {
  it("returns defaults when no effects declared", () => {
    const result = derivePolicy({
      commandId: "lint",
      options: {},
    });
    expect(result.riskLevel).toBe("low");
    expect(result.requiresConfirmation).toBe(false);
    expect(result.sideEffects).toEqual([]);
    expect(result.reads).toEqual([]);
    expect(result.writes).toEqual([]);
  });

  it("applies command base effects always", () => {
    const result = derivePolicy({
      commandId: "build",
      commandEffects: {
        riskLevel: "low",
        writes: [{ target: "docs/", description: "generated docs" }],
      },
      options: {},
    });
    expect(result.riskLevel).toBe("low");
    expect(result.sideEffects).toEqual(["file_write"]);
    expect(result.writes).toEqual([
      {
        kind: "semantic",
        target: "docs/",
        description: "generated docs",
        source: "command:build",
      },
    ]);
  });

  it("merges active option effects with command effects", () => {
    const fixOpt = makeOption({
      name: "fix",
      schema: { type: "boolean" },
      effects: {
        riskLevel: "medium",
        writes: [
          {
            target: "source files",
            description: "auto-fix",
            overwrite: true,
          },
        ],
      },
    });
    const result = derivePolicy({
      commandId: "lint",
      options: makeInput("fix", fixOpt, true, true),
    });
    expect(result.riskLevel).toBe("medium");
    expect(result.sideEffects).toEqual(["file_write"]);
    expect(result.writes).toHaveLength(1);
    expect(result.writes[0]).toMatchObject({
      kind: "semantic",
      target: "source files",
      source: "option:fix",
    });
  });

  it("does not include inactive option effects", () => {
    const fixOpt = makeOption({
      name: "fix",
      schema: { type: "boolean" },
      effects: {
        riskLevel: "medium",
        writes: [{ target: "source files" }],
      },
    });
    const result = derivePolicy({
      commandId: "lint",
      options: makeInput("fix", fixOpt, false, true),
    });
    expect(result.riskLevel).toBe("low");
    expect(result.sideEffects).toEqual([]);
    expect(result.writes).toEqual([]);
  });

  describe("riskLevel max aggregation", () => {
    it("tool init → medium", () => {
      const result = derivePolicy({
        commandId: "init",
        commandEffects: { riskLevel: "medium" },
        options: {},
      });
      expect(result.riskLevel).toBe("medium");
    });

    it("tool init --force → high", () => {
      const forceOpt = makeOption({
        name: "force",
        schema: { type: "boolean" },
        effects: { riskLevel: "high" },
      });
      const result = derivePolicy({
        commandId: "init",
        commandEffects: { riskLevel: "medium" },
        options: makeInput("force", forceOpt, true, true),
      });
      expect(result.riskLevel).toBe("high");
    });

    it("tool build → low", () => {
      const result = derivePolicy({
        commandId: "build",
        commandEffects: { riskLevel: "low" },
        options: {},
      });
      expect(result.riskLevel).toBe("low");
    });

    it("tool build --watch → medium", () => {
      const watchOpt = makeOption({
        name: "watch",
        schema: { type: "boolean" },
        effects: { riskLevel: "medium", executionMode: "long-running" },
      });
      const result = derivePolicy({
        commandId: "build",
        commandEffects: { riskLevel: "low" },
        options: makeInput("watch", watchOpt, true, true),
      });
      expect(result.riskLevel).toBe("medium");
    });

    it("tool lint → low (no effects)", () => {
      const result = derivePolicy({
        commandId: "lint",
        options: {},
      });
      expect(result.riskLevel).toBe("low");
    });

    it("tool lint --fix → medium", () => {
      const fixOpt = makeOption({
        name: "fix",
        schema: { type: "boolean" },
        effects: { riskLevel: "medium" },
      });
      const result = derivePolicy({
        commandId: "lint",
        options: makeInput("fix", fixOpt, true, true),
      });
      expect(result.riskLevel).toBe("medium");
    });
  });

  describe("requiresConfirmation derivation", () => {
    it("auto-true for riskLevel high", () => {
      const result = derivePolicy({
        commandId: "cmd",
        commandEffects: { riskLevel: "high" },
        options: {},
      });
      expect(result.requiresConfirmation).toBe(true);
    });

    it("auto-true for riskLevel critical", () => {
      const result = derivePolicy({
        commandId: "cmd",
        commandEffects: { riskLevel: "critical" },
        options: {},
      });
      expect(result.requiresConfirmation).toBe(true);
    });

    it("false for low/medium by default", () => {
      const result = derivePolicy({
        commandId: "cmd",
        commandEffects: { riskLevel: "medium" },
        options: {},
      });
      expect(result.requiresConfirmation).toBe(false);
    });

    it("explicit override forces confirmation at medium", () => {
      const result = derivePolicy({
        commandId: "cmd",
        commandEffects: { riskLevel: "medium", requiresConfirmation: true },
        options: {},
      });
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe("file contract → option-file effects", () => {
    it("file.mode: read → reads kind:option-file", () => {
      const configOpt = makeOption({
        name: "config",
        schema: { type: "string" },
        file: { mode: "read", exists: true },
      });
      const result = derivePolicy({
        commandId: "lint",
        options: makeInput("config", configOpt, "config.yaml", true),
      });
      expect(result.reads).toEqual([
        {
          kind: "option-file",
          option: "config",
          path: "config.yaml",
          source: "option:config",
        },
      ]);
    });

    it("file.mode: write → writes kind:option-file + sideEffects", () => {
      const outputOpt = makeOption({
        name: "output",
        schema: { type: "string" },
        file: { mode: "write" },
      });
      const result = derivePolicy({
        commandId: "build",
        options: makeInput("output", outputOpt, "./out", true),
      });
      expect(result.sideEffects).toContain("file_write");
      expect(result.writes).toEqual([
        {
          kind: "option-file",
          option: "output",
          path: "./out",
          mode: "write",
          source: "option:output",
        },
      ]);
    });

    it("file.mode: readWrite → both reads and writes", () => {
      const dbOpt = makeOption({
        name: "database",
        schema: { type: "string" },
        file: { mode: "readWrite" },
      });
      const result = derivePolicy({
        commandId: "migrate",
        options: makeInput("database", dbOpt, "db.sqlite", true),
      });
      expect(result.reads).toHaveLength(1);
      expect(result.writes).toHaveLength(1);
      expect(result.reads[0]).toMatchObject({ kind: "option-file" });
      expect(result.writes[0]).toMatchObject({ kind: "option-file" });
    });
  });

  describe("network effects", () => {
    it("command-level network → sideEffects includes network", () => {
      const result = derivePolicy({
        commandId: "deploy",
        commandEffects: { riskLevel: "high", network: true },
        options: {},
      });
      expect(result.sideEffects).toContain("network");
    });

    it("option-level network → sideEffects includes network when active", () => {
      const endpointOpt = makeOption({
        name: "endpoint",
        schema: { type: "string" },
        effects: {
          network: { description: "calls API", domains: ["api.example.com"] },
        },
      });
      const result = derivePolicy({
        commandId: "query",
        options: makeInput("endpoint", endpointOpt, "https://api.example.com", true),
      });
      expect(result.sideEffects).toContain("network");
    });
  });

  describe("sideEffects deduplication", () => {
    it("deduplicates file_write from multiple sources", () => {
      const fixOpt = makeOption({
        name: "fix",
        schema: { type: "boolean" },
        effects: { writes: [{ target: "files" }] },
      });
      const result = derivePolicy({
        commandId: "build",
        commandEffects: { writes: [{ target: "output" }] },
        options: makeInput("fix", fixOpt, true, true),
      });
      const fileWriteCount = result.sideEffects.filter(
        (e) => e === "file_write",
      ).length;
      expect(fileWriteCount).toBe(1);
    });
  });

  describe("executionMode", () => {
    it("sets executionMode from active option", () => {
      const watchOpt = makeOption({
        name: "watch",
        schema: { type: "boolean" },
        effects: { executionMode: "long-running" },
      });
      const result = derivePolicy({
        commandId: "build",
        options: makeInput("watch", watchOpt, true, true),
      });
      expect(result.executionMode).toBe("long-running");
    });

    it("executionMode not included in sideEffects", () => {
      const watchOpt = makeOption({
        name: "watch",
        schema: { type: "boolean" },
        effects: { executionMode: "long-running" },
      });
      const result = derivePolicy({
        commandId: "build",
        options: makeInput("watch", watchOpt, true, true),
      });
      expect(result.sideEffects).not.toContain("long-running");
    });
  });

  describe("requiresSecrets from env", () => {
    it("collects sensitive env vars", () => {
      const result = derivePolicy({
        commandId: "query",
        options: {},
        env: {
          OPENAI_API_KEY: { required: true, sensitive: true },
          LOG_LEVEL: { required: false },
        },
      });
      expect(result.requiresSecrets).toEqual(["OPENAI_API_KEY"]);
    });

    it("omits requiresSecrets when no sensitive env", () => {
      const result = derivePolicy({
        commandId: "query",
        options: {},
        env: {
          LOG_LEVEL: { required: false },
        },
      });
      expect(result.requiresSecrets).toBeUndefined();
    });
  });

  describe("combined scenario: lint --fix --config config.yaml", () => {
    it("produces correct derived policy", () => {
      const configOpt = makeOption({
        name: "config",
        schema: { type: "string" },
        file: { mode: "read", exists: true },
      });
      const fixOpt = makeOption({
        name: "fix",
        schema: { type: "boolean" },
        effects: {
          riskLevel: "medium",
          writes: [
            {
              target: "source files matching lint rules",
              description: "auto-fix lint violations",
              overwrite: true,
            },
          ],
        },
      });
      const formatOpt = makeOption({
        name: "format",
        schema: { type: "string", enum: ["text", "json", "github"] },
      });

      const result = derivePolicy({
        commandId: "lint",
        options: {
          config: { value: "config.yaml", specified: true, definition: configOpt },
          fix: { value: true, specified: true, definition: fixOpt },
          format: { value: undefined, specified: false, definition: formatOpt },
        },
      });

      expect(result.riskLevel).toBe("medium");
      expect(result.requiresConfirmation).toBe(false);
      expect(result.sideEffects).toEqual(["file_write"]);
      expect(result.reads).toEqual([
        {
          kind: "option-file",
          option: "config",
          path: "config.yaml",
          source: "option:config",
        },
      ]);
      expect(result.writes).toEqual([
        {
          kind: "semantic",
          target: "source files matching lint rules",
          description: "auto-fix lint violations",
          overwrite: true,
          source: "option:fix",
        },
      ]);
    });
  });

  describe("combined scenario: build --output ./out", () => {
    it("produces correct derived policy", () => {
      const outputOpt = makeOption({
        name: "output",
        schema: { type: "string" },
        file: { mode: "write" },
      });

      const result = derivePolicy({
        commandId: "build",
        commandEffects: {
          riskLevel: "low",
          writes: [
            {
              target: "docs/, specs/",
              description: "files generated from models",
            },
          ],
        },
        options: makeInput("output", outputOpt, "./out", true),
      });

      expect(result.riskLevel).toBe("low");
      expect(result.sideEffects).toEqual(["file_write"]);
      expect(result.writes).toHaveLength(2);
      expect(result.writes[0]).toMatchObject({
        kind: "semantic",
        source: "command:build",
      });
      expect(result.writes[1]).toMatchObject({
        kind: "option-file",
        option: "output",
        path: "./out",
        source: "option:output",
      });
    });
  });
});

describe("buildIntrospection", () => {
  it("builds correct introspection result", () => {
    const cmd: Command = {
      summary: "Lint source files.",
      options: [
        {
          name: "fix",
          schema: { type: "boolean" },
          effects: {
            riskLevel: "medium",
            writes: [{ target: "source files", overwrite: true }],
          },
        },
        {
          name: "config",
          schema: { type: "string" },
          file: { mode: "read", exists: true },
        },
      ],
      exits: { "0": { description: "OK." } },
    };

    const result = buildIntrospection("lint", cmd, {
      fix: true,
      config: "config.yaml",
    });

    expect(result.command).toBe("lint");
    expect(result.activeOptions).toEqual(["fix", "config"]);
    expect(result.policy.riskLevel).toBe("medium");
    expect(result.policy.reads).toHaveLength(1);
    expect(result.policy.writes).toHaveLength(1);
  });

  it("filters inactive options from activeOptions", () => {
    const cmd: Command = {
      summary: "Lint source files.",
      options: [
        {
          name: "fix",
          schema: { type: "boolean" },
          effects: { riskLevel: "medium" },
        },
      ],
      exits: { "0": { description: "OK." } },
    };

    const result = buildIntrospection("lint", cmd, {});

    expect(result.activeOptions).toEqual([]);
    expect(result.policy.riskLevel).toBe("low");
  });
});
