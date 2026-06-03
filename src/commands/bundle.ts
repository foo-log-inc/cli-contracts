import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildBundleContext } from "../auditor/context-builder.js";
import { runAudit } from "../auditor/auditor.js";
import type { AuditConfig, AuditOptions } from "../auditor/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface BundleOptions {
  projectDir?: string;
  adapter?: string;
  model?: string;
  showPrompt?: boolean;
  failOn?: string;
  output?: string;
  reportFormat?: string;
  logFile?: string;
}

export async function runBundle(
  options: BundleOptions,
): Promise<string | { result: unknown; exitCode: number }> {
  const projectDir = resolve(options.projectDir ?? ".");

  const pkgPath = resolve(projectDir, "package.json");
  let pkgContent: string;
  try {
    pkgContent = readFileSync(pkgPath, "utf-8");
  } catch {
    return {
      result: {
        code: "INVALID_PROJECT",
        message: `No package.json found in ${projectDir}`,
      },
      exitCode: 2,
    };
  }

  const files: Array<{ path: string; content: string }> = [];
  files.push({ path: "package.json", content: pkgContent });

  const pkg = JSON.parse(pkgContent);
  const binEntries = typeof pkg.bin === "string"
    ? { [pkg.name]: pkg.bin }
    : (pkg.bin ?? {});

  for (const binPath of Object.values(binEntries) as string[]) {
    const srcPath = binPath
      .replace(/^\.\/dist\//, "src/")
      .replace(/\.js$/, ".ts");
    tryReadFile(projectDir, srcPath, files);
  }

  const sourcePatterns = [
    "src/index.ts",
    "src/auditor/auditor.ts",
    "src/generators/typescript.ts",
  ];
  for (const pattern of sourcePatterns) {
    tryReadFile(projectDir, pattern, files);
  }

  tryReadFile(projectDir, "cli-contract.yaml", files);

  const existingBundle = tryReadFile(projectDir, "esbuild.bundle.mjs", files);
  if (!existingBundle) {
    tryReadFile(projectDir, "tsup.config.ts", files);
  }

  const pkgRoot = resolve(__dirname, "..", "..");
  let referenceTemplate: string;
  try {
    referenceTemplate = readFileSync(resolve(pkgRoot, "esbuild.bundle.mjs"), "utf-8");
  } catch {
    referenceTemplate = "// Reference template not available";
  }

  const userRequest = buildBundleContext(files, referenceTemplate);

  if (options.showPrompt) {
    return userRequest;
  }

  const auditConfig: AuditConfig = {
    adapter: options.adapter,
    model: options.model,
  };

  const auditOptions: AuditOptions = {
    taskId: "propose-bundle-config",
    format: (options.reportFormat as "json" | "text") ?? "json",
    failOn: (options.failOn as "warning" | "error" | "critical") ?? "error",
    outputFile: options.output,
    logFile: options.logFile,
  };

  const auditResult = await runAudit(
    userRequest,
    auditOptions.taskId,
    auditConfig,
    auditOptions,
  );

  const output = auditResult.data ?? {
    summary: auditResult.errorMessage ?? "Bundle configuration generated",
    risk_level: "low",
    findings: [],
  };

  if (options.output) {
    const content = options.reportFormat === "text"
      ? formatTextOutput(output as Record<string, unknown>)
      : JSON.stringify(output, null, 2);
    await writeFile(resolve(options.output), content, "utf8");
  }

  const exitCode = determineExitCode(
    output as Record<string, unknown>,
    (options.failOn as "warning" | "error" | "critical") ?? "error",
  );
  return { result: output, exitCode };
}

function tryReadFile(
  projectDir: string,
  relPath: string,
  files: Array<{ path: string; content: string }>,
): boolean {
  const absPath = resolve(projectDir, relPath);
  const alreadyIncluded = files.some((f) => f.path === relPath);
  if (alreadyIncluded) return true;

  try {
    const content = readFileSync(absPath, "utf-8");
    files.push({ path: relPath, content });
    return true;
  } catch {
    return false;
  }
}

function determineExitCode(
  result: Record<string, unknown>,
  failOn: string,
): number {
  const findings = result.findings as Array<{ severity: string }> | undefined;
  if (!findings || findings.length === 0) return 0;

  const severityOrder = ["info", "warning", "error", "critical"];
  const threshold = severityOrder.indexOf(failOn);
  if (threshold < 0) return 0;

  const hasBlocking = findings.some(
    (f) => severityOrder.indexOf(f.severity) >= threshold,
  );
  return hasBlocking ? 10 : 0;
}

function formatTextOutput(result: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`Summary: ${result.summary}`);
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
