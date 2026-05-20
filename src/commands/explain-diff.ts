import { resolve, dirname } from "node:path";
import { writeFile } from "node:fs/promises";
import { parseContractFile } from "../parser.js";
import { resolveRefs } from "../ref-resolver.js";
import { runDiff } from "./diff.js";
import { buildDiffExplainContext } from "../auditor/context-builder.js";
import { runAudit } from "../auditor/auditor.js";
import type { AuditConfig, AuditOptions } from "../auditor/types.js";

export interface ExplainDiffOptions {
  base?: string;
  head?: string;
  contractPath?: string;
  adapter?: string;
  model?: string;
  showPrompt?: boolean;
  failOn?: string;
  output?: string;
  reportFormat?: string;
}

export async function runExplainDiff(
  oldPath: string | undefined,
  newPath: string | undefined,
  options: ExplainDiffOptions,
): Promise<string | { result: unknown; exitCode: number }> {
  if (!oldPath || !newPath) {
    return {
      result: { code: "INVALID_ARGS", message: "Both old and new contract files are required" },
      exitCode: 2,
    };
  }

  const absOld = resolve(oldPath);
  const absNew = resolve(newPath);
  const oldDoc = resolveRefs(await parseContractFile(absOld), { basePath: dirname(absOld) });
  const newDoc = resolveRefs(await parseContractFile(absNew), { basePath: dirname(absNew) });

  const diffResult = await runDiff(oldPath, newPath);

  const userRequest = buildDiffExplainContext(
    diffResult,
    oldDoc.info.version,
    newDoc.info.version,
  );

  if (options.showPrompt) {
    return userRequest;
  }

  const auditConfig: AuditConfig = {
    adapter: options.adapter,
    model: options.model,
  };

  const auditOptions: AuditOptions = {
    taskId: "explain-contract-diff",
    format: (options.reportFormat as "json" | "text") ?? "json",
    failOn: (options.failOn as "warning" | "error" | "critical") ?? "error",
    outputFile: options.output,
  };

  const auditResult = await runAudit(
    userRequest,
    auditOptions.taskId,
    auditConfig,
    auditOptions,
  );

  const output = auditResult.data ?? {
    summary: auditResult.errorMessage ?? "Diff explanation completed",
    risk_level: diffResult.has_breaking_changes ? "high" : "low",
    findings: [],
  };

  if (options.output) {
    const content = options.reportFormat === "text"
      ? formatTextOutput(output)
      : JSON.stringify(output, null, 2);
    await writeFile(resolve(options.output), content, "utf8");
  }

  const exitCode = determineExitCode(output, auditOptions.failOn);
  return { result: output, exitCode };
}

function determineExitCode(
  result: { findings?: Array<{ severity: string }> },
  failOn: string,
): number {
  if (!result.findings || result.findings.length === 0) return 0;

  const severityOrder = ["info", "warning", "error", "critical"];
  const threshold = severityOrder.indexOf(failOn);
  if (threshold < 0) return 0;

  const hasBlocking = result.findings.some(
    (f) => severityOrder.indexOf(f.severity) >= threshold,
  );

  return hasBlocking ? 10 : 0;
}

function formatTextOutput(result: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`Summary: ${result.summary}`);
  lines.push(`Risk Level: ${result.risk_level}`);
  const findings = result.findings as Array<Record<string, unknown>> | undefined;
  if (findings && findings.length > 0) {
    lines.push(`\nFindings (${findings.length}):`);
    for (const f of findings) {
      lines.push(`  [${f.severity}] ${f.category}: ${f.message}`);
      if (f.recommendation) lines.push(`    → ${f.recommendation}`);
    }
  }
  return lines.join("\n") + "\n";
}
