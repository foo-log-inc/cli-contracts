import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseContractFile } from "../../../src/parser.js";
import { runDiff } from "../../../src/commands/diff.js";
import {
  buildPolicyAuditContext,
  buildDesignAuditContext,
  buildTestProposalContext,
  buildDiffExplainContext,
  buildSuggestContext,
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

describe("buildTestProposalContext", () => {
  it("builds context with test proposal header", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const context = buildTestProposalContext(doc);

    expect(context).toContain("Test Case Proposal Request");
    expect(context).toContain("Info");
    expect(context).toContain("Command Set:");
  });

  it("includes detailed argument and option info", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract.yaml"),
    );
    const context = buildTestProposalContext(doc);

    expect(context).toContain("users.import");
    expect(context).toContain("Exit codes:");
  });

  it("includes x-agent details", async () => {
    const doc = await parseContractFile(
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
    );
    const context = buildTestProposalContext(doc);

    expect(context).toContain("x-agent:");
    expect(context).toContain("riskLevel");
  });
});

describe("buildDiffExplainContext", () => {
  it("builds context from diff result", async () => {
    const diffResult = await runDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
    );
    const context = buildDiffExplainContext(diffResult, "1.0.0", "2.0.0");

    expect(context).toContain("Diff Explanation Request");
    expect(context).toContain("Old: 1.0.0");
    expect(context).toContain("New: 2.0.0");
    expect(context).toContain("Diff Summary");
  });

  it("includes diff changes", async () => {
    const diffResult = await runDiff(
      resolve(FIXTURES, "valid-contract.yaml"),
      resolve(FIXTURES, "valid-contract-with-xagent.yaml"),
    );
    const context = buildDiffExplainContext(diffResult);

    expect(context).toContain("Diff Explanation Request");
    expect(context).toContain("Diff Summary");
    expect(context).toContain("Has breaking changes");
  });
});

describe("buildSuggestContext", () => {
  it("builds context from README source", () => {
    const context = buildSuggestContext({
      readme: "# My CLI Tool\n\nUsage: my-cli init [options]\n",
    });

    expect(context).toContain("Suggestion Request");
    expect(context).toContain("Source: README");
    expect(context).toContain("my-cli init");
  });

  it("builds context from help output", () => {
    const context = buildSuggestContext({
      help: "Usage: my-cli [command]\n\nCommands:\n  init  Initialize\n",
    });

    expect(context).toContain("Source: --help output");
    expect(context).toContain("Initialize");
  });

  it("builds context from source code", () => {
    const context = buildSuggestContext({
      source: "program.command('init').description('Initialize project');",
    });

    expect(context).toContain("Source: CLI source code");
    expect(context).toContain("Initialize project");
  });

  it("includes source data without hardcoded instructions", () => {
    const context = buildSuggestContext({
      readme: "# Test",
    });

    expect(context).toContain("Suggestion Request");
    expect(context).toContain("Source: README");
    expect(context).toContain("# Test");
  });

  it("handles multiple sources", () => {
    const context = buildSuggestContext({
      readme: "# My Tool",
      source: "program.parse()",
    });

    expect(context).toContain("Source: README");
    expect(context).toContain("Source: CLI source code");
  });
});
