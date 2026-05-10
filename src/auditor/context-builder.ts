import * as yaml from "yaml";
import type { CliContractsDocument } from "../types.js";

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
