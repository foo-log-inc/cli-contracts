import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile, parseContractString } from "../../../src/parser.js";
import { normalizeContract } from "../../../src/normalizer.js";
import { generateTypeScript } from "../../../src/generators/typescript.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("policy.ts generation", () => {
  it("generates policy.ts when contract has effects", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    expect(output).toHaveProperty("policy.ts");
  });

  it("does not generate policy.ts when contract has no effects", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    expect(output).not.toHaveProperty("policy.ts");
  });

  it("policy.ts contains commandDefinitions", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    const policy = output["policy.ts"];
    expect(policy).toContain("commandDefinitions");
    expect(policy).toContain("deriveCommandPolicy");
  });

  it("policy.ts includes command effects data", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    const policy = output["policy.ts"];
    expect(policy).toContain('"build"');
    expect(policy).toContain('"lint"');
  });

  it("index.ts exports policy when effects exist", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    expect(output["index.ts"]).toContain("deriveCommandPolicy");
    expect(output["index.ts"]).toContain("commandDefinitions");
  });

  it("index.ts does not export policy when no effects", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    expect(output["index.ts"]).not.toContain("deriveCommandPolicy");
  });
});

describe("--introspect in program.ts", () => {
  it("adds --introspect global option when effects exist", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    const program = output["program.ts"];
    expect(program).toContain("--introspect");
    expect(program).toContain("deriveCommandPolicy");
  });

  it("does not add --introspect when no effects", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    const program = output["program.ts"];
    expect(program).not.toContain("--introspect");
  });

  it("generates introspect check in command actions", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    const program = output["program.ts"];
    expect(program).toContain("globalOpts.introspect");
    expect(program).toContain("JSON.stringify(policy, null, 2)");
  });

  it("imports policy module in program.ts when effects exist", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-effects.yaml"),
    );
    const ctx = normalizeContract(doc);
    const output = generateTypeScript(ctx);
    const program = output["program.ts"];
    expect(program).toContain('import { commandDefinitions, deriveCommandPolicy } from "./policy.js"');
  });
});
