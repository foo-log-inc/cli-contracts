import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { writeFile } from "node:fs/promises";
import { parseContractFile } from "../parser.js";
import { validateContract } from "../validator.js";
import { resolveRefs } from "../ref-resolver.js";
import {
  buildReferenceCheckContext,
  buildImplementationCheckContext,
} from "../auditor/context-builder.js";
import { runAudit } from "../auditor/auditor.js";
import type { AuditConfig, AuditOptions } from "../auditor/types.js";
import { loadConfig } from "../config.js";

export type CheckScope = "contract" | "implementation" | "all";

export interface CheckReferenceOptions {
  file?: string;
  adapter?: string;
  model?: string;
  showPrompt?: boolean;
  failOn?: string;
  output?: string;
  reportFormat?: string;
  scope?: CheckScope;
  logFile?: string;
}

export async function runCheckReference(
  contractFiles: string[],
  options: CheckReferenceOptions,
): Promise<string | { result: unknown; exitCode: number }> {
  const filePath = resolve(options.file ?? contractFiles[0]);
  const doc = await parseContractFile(filePath);

  const validation = validateContract(doc, { basePath: dirname(filePath) });
  if (!validation.valid) {
    return {
      result: validation,
      exitCode: 2,
    };
  }

  const resolved = resolveRefs(doc, { basePath: dirname(filePath) });
  const scope: CheckScope = options.scope ?? "contract";

  const prompts: { scope: CheckScope; userRequest: string; taskId: string }[] = [];

  if (scope === "contract" || scope === "all") {
    prompts.push({
      scope: "contract",
      userRequest: buildReferenceCheckContext(resolved),
      taskId: "check-reference-conformance",
    });
  }

  if (scope === "implementation" || scope === "all") {
    const sourceFiles = await discoverSourceFiles(dirname(filePath));
    const contractYaml = readFileSync(filePath, "utf-8");
    prompts.push({
      scope: "implementation",
      userRequest: buildImplementationCheckContext(resolved, contractYaml, sourceFiles),
      taskId: "check-implementation-conformance",
    });
  }

  if (options.showPrompt) {
    return prompts.map((p) => `--- scope: ${p.scope} ---\n${p.userRequest}`).join("\n\n");
  }

  const auditConfig: AuditConfig = {
    adapter: options.adapter,
    model: options.model,
  };

  const allFindings: Array<Record<string, unknown>> = [];
  let lastOutput: Record<string, unknown> = {};

  for (const prompt of prompts) {
    const auditOptions: AuditOptions = {
      taskId: prompt.taskId,
      format: (options.reportFormat as "json" | "text") ?? "json",
      failOn: (options.failOn as "warning" | "error" | "critical") ?? "error",
      outputFile: options.output,
      logFile: options.logFile,
    };

    const auditResult = await runAudit(
      prompt.userRequest,
      auditOptions.taskId,
      auditConfig,
      auditOptions,
    );

    const output = (auditResult.data ?? {
      summary: auditResult.errorMessage ?? `${prompt.scope} check completed`,
      risk_level: "low",
      findings: [],
    }) as Record<string, unknown>;

    const findings = output.findings as Array<Record<string, unknown>> | undefined;
    if (findings) {
      allFindings.push(...findings.map((f) => ({ ...f, scope: prompt.scope })));
    }

    lastOutput = output;
  }

  const mergedOutput = prompts.length > 1
    ? {
        summary: `Reference check completed (scopes: ${prompts.map((p) => p.scope).join(", ")})`,
        risk_level: lastOutput.risk_level ?? "low",
        findings: allFindings,
        recommendedActions: lastOutput.recommendedActions,
      }
    : lastOutput;

  if (options.output) {
    const content = options.reportFormat === "text"
      ? formatTextOutput(mergedOutput)
      : JSON.stringify(mergedOutput, null, 2);
    await writeFile(resolve(options.output), content, "utf8");
  }

  const failOn = (options.failOn as "warning" | "error" | "critical") ?? "error";
  const exitCode = determineExitCode(mergedOutput, failOn);
  return { result: mergedOutput, exitCode };
}

interface SourceFile {
  path: string;
  content: string;
}

async function discoverSourceFiles(projectDir: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  const configResult = await loadConfig(resolve(projectDir, "cli-contracts.config.yaml")).catch(() => null);
  const generatedDir = configResult?.config?.generators?.typescript?.output ?? "./src/generated";
  const absGeneratedDir = resolve(projectDir, generatedDir);

  const candidates = [
    resolve(absGeneratedDir, "program.ts"),
    resolve(projectDir, "src", "cli.ts"),
    resolve(projectDir, "src", "cli", "index.ts"),
  ];

  for (const candidatePath of candidates) {
    try {
      const content = readFileSync(candidatePath, "utf-8");
      const relPath = candidatePath.replace(projectDir + "/", "");
      files.push({ path: relPath, content });
    } catch {
      // File doesn't exist, skip
    }
  }

  try {
    const pkgPath = resolve(projectDir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (pkg.bin) {
      const binPaths = typeof pkg.bin === "string"
        ? [pkg.bin]
        : Object.values(pkg.bin) as string[];
      for (const binPath of binPaths) {
        const srcPath = binPath.replace(/^\.\/dist\//, "./src/").replace(/\.js$/, ".ts");
        const absPath = resolve(projectDir, srcPath);
        const alreadyIncluded = files.some(
          (f) => resolve(projectDir, f.path) === absPath,
        );
        if (!alreadyIncluded) {
          try {
            const content = readFileSync(absPath, "utf-8");
            files.push({ path: srcPath.replace(/^\.\//, ""), content });
          } catch {
            // Skip
          }
        }
      }
    }
  } catch {
    // No package.json or unreadable
  }

  return files;
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
