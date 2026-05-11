import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import * as yaml from "yaml";
import { buildSuggestContext } from "../auditor/context-builder.js";
import { runAudit } from "../auditor/auditor.js";
import type { AuditConfig, AuditOptions } from "../auditor/types.js";

export interface SuggestOptions {
  fromReadme?: string;
  fromHelp?: string;
  fromSource?: string;
  adapter?: string;
  model?: string;
  showPrompt?: boolean;
  failOn?: string;
  output?: string;
  reportFormat?: string;
}

export async function runSuggest(
  options: SuggestOptions,
): Promise<{ result: unknown; exitCode: number }> {
  if (!options.fromReadme && !options.fromHelp && !options.fromSource) {
    return {
      result: {
        code: "INVALID_ARGS",
        message: "At least one source is required: --from-readme, --from-help, or --from-source",
      },
      exitCode: 2,
    };
  }

  const sources: { readme?: string; help?: string; source?: string } = {};

  if (options.fromReadme) {
    sources.readme = await readFile(resolve(options.fromReadme), "utf8");
  }
  if (options.fromHelp) {
    sources.help = await readFile(resolve(options.fromHelp), "utf8");
  }
  if (options.fromSource) {
    sources.source = await readFile(resolve(options.fromSource), "utf8");
  }

  const userRequest = buildSuggestContext(sources);

  const auditConfig: AuditConfig = {
    adapter: options.adapter,
    model: options.model,
  };

  const auditOptions: AuditOptions = {
    taskId: "suggest-contract",
    format: (options.reportFormat as "json" | "text") ?? "json",
    showPrompt: options.showPrompt ?? false,
    failOn: (options.failOn as "warning" | "error" | "critical") ?? "error",
    outputFile: options.output,
  };

  const auditResult = await runAudit(
    userRequest,
    auditOptions.taskId,
    auditConfig,
    auditOptions,
  );

  if (auditResult.showPrompt) {
    return {
      result: { showPrompt: true, prompt: auditResult.prompt },
      exitCode: 0,
    };
  }

  const output = auditResult.data ?? {
    summary: auditResult.errorMessage ?? "Suggestion completed",
    riskLevel: "low",
    findings: [],
  };

  if (options.output) {
    const content = options.reportFormat === "yaml"
      ? formatYamlOutput(output)
      : options.reportFormat === "text"
        ? formatTextOutput(output)
        : JSON.stringify(output, null, 2);
    await writeFile(resolve(options.output), content, "utf8");
  }

  const exitCode = auditResult.status === "error" ? 1 : 0;
  return { result: output, exitCode };
}

function formatTextOutput(result: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`Summary: ${result.summary}`);
  const findings = result.findings as Array<Record<string, unknown>> | undefined;
  if (findings && findings.length > 0) {
    lines.push(`\nSuggested Commands (${findings.length}):`);
    for (const f of findings) {
      lines.push(`  [${f.severity}] ${f.category}: ${f.message}`);
      if (f.recommendation) lines.push(`    → ${f.recommendation}`);
    }
  }
  return lines.join("\n") + "\n";
}

function formatYamlOutput(result: Record<string, unknown>): string {
  return yaml.stringify(result);
}
