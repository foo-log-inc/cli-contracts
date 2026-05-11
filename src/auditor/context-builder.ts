import * as yaml from "yaml";
import type { CliContractsDocument } from "../types.js";
import type { DiffResult, DiffChange } from "../types.js";

/**
 * Builds the user_request string from a CLI contract document.
 * This is the only cli-contracts–specific logic; the rest is
 * delegated to agent-contracts-runtime via runTask().
 */
export function buildPolicyAuditContext(
  doc: CliContractsDocument,
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Policy Audit Request");
  sections.push(`## Info\n- Title: ${doc.info.title}\n- Version: ${doc.info.version}`);

  for (const [setId, cs] of Object.entries(doc.commandSets)) {
    sections.push(`## Command Set: ${setId}`);
    if (cs.summary) sections.push(`Summary: ${cs.summary}`);

    for (const [cmdId, cmd] of Object.entries(cs.commands)) {
      const lines: string[] = [`### Command: ${cmdId}`];
      lines.push(`- Summary: ${cmd.summary}`);
      if (cmd.description) lines.push(`- Description: ${cmd.description}`);

      if (cmd.arguments && cmd.arguments.length > 0) {
        lines.push(`- Arguments: ${cmd.arguments.map((a) => a.name).join(", ")}`);
      }
      if (cmd.options && cmd.options.length > 0) {
        lines.push(`- Options: ${cmd.options.map((o) => `--${o.name}`).join(", ")}`);
      }

      const exitCodes = Object.keys(cmd.exits).join(", ");
      lines.push(`- Exit codes: ${exitCodes}`);

      const xAgent = (cmd as Record<string, unknown>)["x-agent"];
      if (xAgent) {
        lines.push(`- Current x-agent policy:\n\`\`\`yaml\n${yaml.stringify(xAgent)}\`\`\``);
      } else {
        lines.push("- x-agent: (none — policy missing)");
      }

      sections.push(lines.join("\n"));
    }
  }

  return sections.join("\n\n");
}

export function buildDesignAuditContext(
  doc: CliContractsDocument,
  checks?: string[],
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Design Audit Request");
  sections.push(`## Info\n- Title: ${doc.info.title}\n- Version: ${doc.info.version}`);

  if (checks && checks.length > 0) {
    sections.push(`## Requested Checks\n${checks.map((c) => `- ${c}`).join("\n")}`);
  }

  sections.push("## Full Contract\n```yaml\n" + yaml.stringify(doc) + "```");

  return sections.join("\n\n");
}

export function buildTestProposalContext(
  doc: CliContractsDocument,
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Test Case Proposal Request");
  sections.push(`## Info\n- Title: ${doc.info.title}\n- Version: ${doc.info.version}`);

  for (const [setId, cs] of Object.entries(doc.commandSets)) {
    sections.push(`## Command Set: ${setId}`);

    for (const [cmdId, cmd] of Object.entries(cs.commands)) {
      const lines: string[] = [`### Command: ${cmdId}`];
      lines.push(`- Summary: ${cmd.summary}`);

      if (cmd.arguments && cmd.arguments.length > 0) {
        const argDetail = cmd.arguments.map((a) => {
          const parts = [a.name];
          if (a.required) parts.push("(required)");
          if (a.variadic) parts.push("(variadic)");
          if (a.file) parts.push(`[file: mode=${a.file.mode}, exists=${a.file.exists}]`);
          return parts.join(" ");
        });
        lines.push(`- Arguments: ${argDetail.join("; ")}`);
      }

      if (cmd.options && cmd.options.length > 0) {
        const optDetail = cmd.options.map((o) => {
          const parts = [`--${o.name}`];
          if (o.required) parts.push("(required)");
          if (o.schema?.enum) parts.push(`enum: [${(o.schema.enum as string[]).join(",")}]`);
          if (o.schema?.default !== undefined) parts.push(`default: ${o.schema.default}`);
          if (o.file) parts.push(`[file: mode=${o.file.mode}, exists=${o.file.exists}]`);
          return parts.join(" ");
        });
        lines.push(`- Options: ${optDetail.join("; ")}`);
      }

      const exits = Object.entries(cmd.exits).map(
        ([code, exit]) => `  ${code}: ${exit.description}`,
      );
      lines.push(`- Exit codes:\n${exits.join("\n")}`);

      if (cmd.streams) {
        lines.push(`- Streams: ${Object.keys(cmd.streams).join(", ")}`);
      }

      const xAgent = (cmd as Record<string, unknown>)["x-agent"];
      if (xAgent) {
        lines.push(`- x-agent:\n\`\`\`yaml\n${yaml.stringify(xAgent)}\`\`\``);
      }

      sections.push(lines.join("\n"));
    }
  }

  return sections.join("\n\n");
}

export function buildDiffExplainContext(
  diffResult: DiffResult,
  oldVersion?: string,
  newVersion?: string,
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Diff Explanation Request");

  if (oldVersion || newVersion) {
    sections.push(
      `## Versions\n- Old: ${oldVersion ?? "(unknown)"}\n- New: ${newVersion ?? "(unknown)"}`,
    );
  }

  sections.push(
    `## Diff Summary\n` +
    `- Has breaking changes: ${diffResult.hasBreakingChanges}\n` +
    `- Breaking count: ${diffResult.breakingCount ?? 0}\n` +
    `- Non-breaking count: ${diffResult.nonBreakingCount ?? 0}`,
  );

  if (diffResult.changes.length > 0) {
    sections.push("## Changes");
    for (const change of diffResult.changes) {
      const lines: string[] = [
        `### ${change.type.toUpperCase()}: ${change.path}`,
        `- Breaking: ${change.breaking}`,
        `- Description: ${change.description}`,
      ];
      sections.push(lines.join("\n"));
    }
  }

  return sections.join("\n\n");
}

// ─── Reference Conformance Check ────────────────────────────────

const REFERENCE_OPTIONS = [
  "adapter", "model", "dry-run", "fail-on", "output", "report-format",
] as const;

const REFERENCE_EXIT_CODES = ["0", "1", "10", "11", "12"] as const;

const REFERENCE_XAGENT_REQUIRED = ["safeDryRunOption"] as const;
const REFERENCE_XAGENT_RECOMMENDED = [
  "sideEffectNote", "expectedDurationMs", "retryableExitCodes",
] as const;

interface CommandPreAnalysis {
  commandId: string;
  commandSetId: string;
  presentOptions: string[];
  missingOptions: string[];
  presentExitCodes: string[];
  missingExitCodes: string[];
  xAgentPresent: boolean;
  xAgentMissingRequired: string[];
  xAgentMissingRecommended: string[];
  stdoutSchemaRef: string | null;
  hasAgentAuditResultShape: boolean;
  usesExternalHandoffRef: boolean;
}

const AUDIT_RESULT_REF_PATTERNS = [
  "AgentAuditResult",
  "agent-audit-result",
  "audit-result",
] as const;

function isAuditResultRef(ref: string): boolean {
  return AUDIT_RESULT_REF_PATTERNS.some((p) => ref.includes(p));
}

function analyzeCommand(
  cmdId: string, setId: string, cmd: Record<string, unknown>,
): CommandPreAnalysis {
  const options = (cmd.options ?? []) as Array<{ name: string }>;
  const optionNames = options.map((o) => o.name);
  const presentOptions = REFERENCE_OPTIONS.filter((o) => optionNames.includes(o));
  const missingOptions = REFERENCE_OPTIONS.filter((o) => !optionNames.includes(o));

  const exits = cmd.exits as Record<string, unknown> | undefined;
  const exitKeys = exits ? Object.keys(exits) : [];
  const presentExitCodes = REFERENCE_EXIT_CODES.filter((c) => exitKeys.includes(c));
  const missingExitCodes = REFERENCE_EXIT_CODES.filter((c) => !exitKeys.includes(c));

  const xAgent = cmd["x-agent"] as Record<string, unknown> | undefined;
  const xAgentPresent = !!xAgent;
  const xAgentMissingRequired = xAgentPresent
    ? REFERENCE_XAGENT_REQUIRED.filter((k) => !(k in xAgent!))
    : [...REFERENCE_XAGENT_REQUIRED];
  const xAgentMissingRecommended = xAgentPresent
    ? REFERENCE_XAGENT_RECOMMENDED.filter((k) => !(k in xAgent!))
    : [...REFERENCE_XAGENT_RECOMMENDED];

  let stdoutSchemaRef: string | null = null;
  let hasAgentAuditResultShape = false;
  let usesExternalHandoffRef = false;
  if (exits) {
    const exit0 = exits["0"] as Record<string, unknown> | undefined;
    if (exit0) {
      const stdout = exit0.stdout as Record<string, unknown> | undefined;
      if (stdout?.schema) {
        const schema = stdout.schema as Record<string, unknown>;
        if (schema.$ref) {
          stdoutSchemaRef = schema.$ref as string;
          hasAgentAuditResultShape = isAuditResultRef(stdoutSchemaRef);
          usesExternalHandoffRef = !stdoutSchemaRef.startsWith("#/");
        } else if (schema.properties) {
          const props = schema.properties as Record<string, unknown>;
          hasAgentAuditResultShape = "summary" in props && "findings" in props;
        }
      }
    }
  }

  return {
    commandId: cmdId, commandSetId: setId,
    presentOptions, missingOptions,
    presentExitCodes, missingExitCodes,
    xAgentPresent, xAgentMissingRequired, xAgentMissingRecommended,
    stdoutSchemaRef, hasAgentAuditResultShape, usesExternalHandoffRef,
  };
}

export function buildReferenceCheckContext(
  doc: CliContractsDocument,
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Reference Conformance Check");
  sections.push(`## Info\n- Title: ${doc.info.title}\n- Version: ${doc.info.version}`);

  const analyses: CommandPreAnalysis[] = [];

  for (const [setId, cs] of Object.entries(doc.commandSets)) {
    for (const [cmdId, cmd] of Object.entries(cs.commands)) {
      const cmdRecord = cmd as unknown as Record<string, unknown>;
      analyses.push(analyzeCommand(cmdId, setId, cmdRecord));
    }
  }

  sections.push(`## Total Commands: ${analyses.length}`);

  sections.push("## Deterministic Pre-Analysis");
  for (const a of analyses) {
    const lines: string[] = [`### Command: ${a.commandSetId}/${a.commandId}`];

    lines.push(`**Options** (${a.presentOptions.length}/${REFERENCE_OPTIONS.length})`);
    if (a.missingOptions.length > 0) {
      lines.push(`- MISSING: ${a.missingOptions.map((o) => `--${o}`).join(", ")}`);
    } else {
      lines.push("- All standard options present");
    }

    lines.push(`**Exit Codes** (${a.presentExitCodes.length}/${REFERENCE_EXIT_CODES.length})`);
    if (a.missingExitCodes.length > 0) {
      lines.push(`- MISSING: ${a.missingExitCodes.join(", ")}`);
    } else {
      lines.push("- All standard exit codes present");
    }

    lines.push(`**x-agent** ${a.xAgentPresent ? "present" : "MISSING"}`);
    if (a.xAgentMissingRequired.length > 0) {
      lines.push(`- MISSING required: ${a.xAgentMissingRequired.join(", ")}`);
    }
    if (a.xAgentMissingRecommended.length > 0) {
      lines.push(`- MISSING recommended: ${a.xAgentMissingRecommended.join(", ")}`);
    }

    lines.push(`**Output Schema**: ${a.stdoutSchemaRef ?? "(none)"}`);
    lines.push(`- Audit result schema conformance: ${a.hasAgentAuditResultShape ? "YES" : "NO / UNKNOWN"}`);
    if (a.usesExternalHandoffRef) {
      lines.push("- References external handoff schema (agent-contracts canonical)");
    } else if (a.stdoutSchemaRef?.startsWith("#/")) {
      lines.push("- References internal schema (consider migrating to agent-contracts $ref)");
    }

    sections.push(lines.join("\n"));
  }

  sections.push(
    "## Full Contract (for semantic evaluation)\n```yaml\n" +
    yaml.stringify(doc) + "```",
  );

  return sections.join("\n\n");
}

export function buildSuggestContext(
  sources: { readme?: string; help?: string; source?: string },
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Suggestion Request");

  if (sources.readme) {
    sections.push(`## Source: README\n\`\`\`\n${sources.readme}\n\`\`\``);
  }

  if (sources.help) {
    sections.push(`## Source: --help output\n\`\`\`\n${sources.help}\n\`\`\``);
  }

  if (sources.source) {
    sections.push(`## Source: CLI source code\n\`\`\`\n${sources.source}\n\`\`\``);
  }

  return sections.join("\n\n");
}
