import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { parseContractFile } from "../parser.js";
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
  dryRun?: boolean;
  failOn?: string;
  output?: string;
  reportFormat?: string;
}

export async function runExplainDiff(
  oldPath: string | undefined,
  newPath: string | undefined,
  options: ExplainDiffOptions,
): Promise<{ result: unknown; exitCode: number }> {
  if (!oldPath || !newPath) {
    return {
      result: { code: "INVALID_ARGS", message: "Both old and new contract files are required" },
      exitCode: 2,
    };
  }

  const oldDoc = await parseContractFile(resolve(oldPath));
  const newDoc = await parseContractFile(resolve(newPath));

  const diffResult = await runDiff(oldPath, newPath);

  const userRequest = buildDiffExplainContext(
    diffResult,
    oldDoc.info.version,
    newDoc.info.version,
  );

  const auditConfig: AuditConfig = {
    adapter: options.adapter,
    model: options.model,
  };

  const auditOptions: AuditOptions = {
    taskId: "explain-contract-diff",
    format: (options.reportFormat as "json" | "text") ?? "json",
    dryRun: options.dryRun ?? false,
    failOn: (options.failOn as "warning" | "error" | "critical") ?? "error",
    outputFile: options.output,
  };

  const auditResult = await runAudit(
    userRequest,
    auditOptions.taskId,
    auditConfig,
    auditOptions,
  );

  if (auditResult.dryRun) {
    return {
      result: { dryRun: true, prompt: auditResult.prompt },
      exitCode: 0,
    };
  }

  const output = auditResult.data ?? {
    summary: auditResult.errorMessage ?? "Diff explanation completed",
    riskLevel: diffResult.hasBreakingChanges ? "high" : "low",
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
  lines.push(`Risk Level: ${result.riskLevel}`);
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
