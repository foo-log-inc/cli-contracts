import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { parseContractFile } from "../parser.js";
import { validateContract } from "../validator.js";
import { buildReferenceCheckContext } from "../auditor/context-builder.js";
import { runAudit } from "../auditor/auditor.js";
import type { AuditConfig, AuditOptions } from "../auditor/types.js";

export interface CheckReferenceOptions {
  file?: string;
  adapter?: string;
  model?: string;
  dryRun?: boolean;
  failOn?: string;
  output?: string;
  reportFormat?: string;
}

export async function runCheckReference(
  contractFiles: string[],
  options: CheckReferenceOptions,
): Promise<{ result: unknown; exitCode: number }> {
  const filePath = resolve(options.file ?? contractFiles[0]);
  const doc = await parseContractFile(filePath);

  const validation = validateContract(doc);
  if (!validation.valid) {
    return {
      result: validation,
      exitCode: 2,
    };
  }

  const userRequest = buildReferenceCheckContext(doc);

  const auditConfig: AuditConfig = {
    adapter: options.adapter,
    model: options.model,
  };

  const auditOptions: AuditOptions = {
    taskId: "check-reference-conformance",
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
    summary: auditResult.errorMessage ?? "Reference conformance check completed",
    riskLevel: "low",
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
      if (f.target) lines.push(`    target: ${f.target}`);
      if (f.recommendation) lines.push(`    → ${f.recommendation}`);
    }
  }
  const actions = result.recommendedActions as Array<Record<string, unknown>> | undefined;
  if (actions && actions.length > 0) {
    lines.push(`\nRecommended Actions (${actions.length}):`);
    for (const a of actions) {
      lines.push(`  [${a.kind}] ${a.title}`);
      if (a.rationale) lines.push(`    ${a.rationale}`);
    }
  }
  return lines.join("\n") + "\n";
}
