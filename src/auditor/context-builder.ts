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
