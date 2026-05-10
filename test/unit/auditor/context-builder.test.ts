import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile } from "../../../src/parser.js";
import {
  buildPolicyAuditContext,
  buildDesignAuditContext,
} from "../../../src/auditor/context-builder.js";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures");

describe("buildPolicyAuditContext", () => {
  it("builds context from a contract with x-agent", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
    );
    const context = buildPolicyAuditContext(doc);

    expect(context).toContain("Policy Audit Request");
    expect(context).toContain("X-Agent Test CLI");
    expect(context).toContain("safe-read");
    expect(context).toContain("dangerous-write");
    expect(context).toContain("riskLevel: high");
  });

  it("marks commands without x-agent as missing", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const context = buildPolicyAuditContext(doc);

    expect(context).toContain("users.list");
    expect(context).toContain("policy missing");
    expect(context).toContain("users.import");
    expect(context).toContain("riskLevel: high");
  });

  it("includes command arguments and options", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
    );
    const context = buildPolicyAuditContext(doc);

    expect(context).toContain("Arguments: input");
    expect(context).toContain("--dry-run");
  });
});

describe("buildDesignAuditContext", () => {
  it("builds context with full contract", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const context = buildDesignAuditContext(doc);

    expect(context).toContain("Design Audit Request");
    expect(context).toContain("Full Contract");
    expect(context).toContain("Test CLI");
  });

  it("includes requested checks", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const context = buildDesignAuditContext(doc, ["agent-policy", "exit-code"]);

    expect(context).toContain("Requested Checks");
    expect(context).toContain("agent-policy");
    expect(context).toContain("exit-code");
  });

  it("omits checks section when no checks specified", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const context = buildDesignAuditContext(doc);

    expect(context).not.toContain("Requested Checks");
  });
});
