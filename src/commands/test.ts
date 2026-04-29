import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import _Ajv from "ajv";
const Ajv = _Ajv.default ?? _Ajv;
import { parseContractFile } from "../parser.js";
import { resolveRefs } from "../ref-resolver.js";
import type { CliContractsDocument, ExecutionProfile } from "../types.js";

const execFileAsync = promisify(execFile);

export interface ContractTestCase {
  id: string;
  commandSet: string;
  command: string;
  profile?: string;
  args?: Record<string, unknown>;
  options?: Record<string, unknown>;
  stdin?: string;
  expect: {
    exitCode: number;
    stdout?: {
      matchesSchema?: string;
      contains?: string;
      absent?: boolean;
    };
    stderr?: {
      matchesSchema?: string;
      contains?: string;
      absent?: boolean;
    };
  };
}

export interface ContractViolation {
  type: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface TestCaseResult {
  id: string;
  status: "passed" | "failed" | "skipped";
  durationMs?: number;
  violations?: ContractViolation[];
}

export interface TestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  cases: TestCaseResult[];
}

export interface TestOptions {
  profile?: string;
  caseIds?: string[];
  casesDir?: string;
  timeoutMs?: number;
  bail?: boolean;
  env?: Record<string, string>;
  executionProfiles?: Record<string, ExecutionProfile>;
  contractFile?: string;
}

export async function runContractTests(
  contractFiles: string[],
  options: TestOptions = {},
): Promise<TestResult> {
  const startTime = Date.now();
  const casesDir = resolve(options.casesDir ?? "tests/cli-contracts");
  const cases = await loadTestCases(casesDir);

  const filteredCases = options.caseIds
    ? cases.filter((c) => options.caseIds!.includes(c.id))
    : cases;

  let contractDoc: CliContractsDocument | undefined;
  if (contractFiles.length > 0) {
    contractDoc = await parseContractFile(resolve(contractFiles[0]));
    contractDoc = resolveRefs(contractDoc);
  }

  const results: TestCaseResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const testCase of filteredCases) {
    if (options.bail && failed > 0) {
      results.push({ id: testCase.id, status: "skipped" });
      skipped++;
      continue;
    }

    const result = await executeTestCase(
      testCase,
      contractDoc,
      options,
    );
    results.push(result);

    if (result.status === "passed") passed++;
    else if (result.status === "failed") failed++;
    else skipped++;
  }

  return {
    total: filteredCases.length,
    passed,
    failed,
    skipped,
    durationMs: Date.now() - startTime,
    cases: results,
  };
}

async function loadTestCases(casesDir: string): Promise<ContractTestCase[]> {
  let files: string[];
  try {
    files = await readdir(casesDir);
  } catch {
    return [];
  }

  const cases: ContractTestCase[] = [];
  for (const file of files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))) {
    const content = await readFile(join(casesDir, file), "utf-8");
    const testCase = parseYaml(content) as ContractTestCase;
    cases.push(testCase);
  }
  return cases;
}

async function executeTestCase(
  testCase: ContractTestCase,
  doc: CliContractsDocument | undefined,
  options: TestOptions,
): Promise<TestCaseResult> {
  const startTime = Date.now();
  const violations: ContractViolation[] = [];

  const profileName = testCase.profile ?? options.profile ?? "local";
  const profile = options.executionProfiles?.[profileName];

  if (!profile) {
    return {
      id: testCase.id,
      status: "skipped",
      durationMs: Date.now() - startTime,
      violations: [{
        type: "exit_code_mismatch",
        message: `Execution profile "${profileName}" not found`,
      }],
    };
  }

  const csProfile = profile.commandSets[testCase.commandSet];
  if (!csProfile) {
    return {
      id: testCase.id,
      status: "skipped",
      durationMs: Date.now() - startTime,
      violations: [{
        type: "exit_code_mismatch",
        message: `Command set "${testCase.commandSet}" not found in profile "${profileName}"`,
      }],
    };
  }

  const cmdParts = csProfile.command.split(/\s+/);
  const executable = cmdParts[0];
  const baseArgs = cmdParts.slice(1);

  const cmdPath = testCase.command.split(".").join(" ").split(" ");
  const allArgs = [...baseArgs, ...cmdPath];

  if (testCase.args) {
    for (const val of Object.values(testCase.args)) {
      allArgs.push(String(val));
    }
  }

  if (testCase.options) {
    for (const [key, val] of Object.entries(testCase.options)) {
      if (typeof val === "boolean") {
        if (val) allArgs.push(`--${key}`);
      } else {
        allArgs.push(`--${key}`, String(val));
      }
    }
  }

  let stdout = "";
  let stderr = "";
  let exitCode: number;

  try {
    const result = await execFileAsync(executable, allArgs, {
      timeout: options.timeoutMs ?? 30000,
      env: { ...process.env, ...options.env },
    });
    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = 0;
  } catch (err: unknown) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string };
    stdout = e.stdout ?? "";
    stderr = e.stderr ?? "";
    exitCode = typeof e.code === "number" ? e.code : 1;
  }

  if (exitCode !== testCase.expect.exitCode) {
    violations.push({
      type: "exit_code_mismatch",
      message: `Expected exit code ${testCase.expect.exitCode}, got ${exitCode}`,
      expected: testCase.expect.exitCode,
      actual: exitCode,
    });
  }

  if (testCase.expect.stdout) {
    if (testCase.expect.stdout.absent && stdout.trim().length > 0) {
      violations.push({
        type: "stdout_format_mismatch",
        message: "Expected no stdout, but got output",
        actual: stdout.slice(0, 200),
      });
    }
    if (testCase.expect.stdout.contains && !stdout.includes(testCase.expect.stdout.contains)) {
      violations.push({
        type: "stdout_format_mismatch",
        message: `stdout does not contain expected string`,
        expected: testCase.expect.stdout.contains,
        actual: stdout.slice(0, 200),
      });
    }
    if (testCase.expect.stdout.matchesSchema && doc) {
      const schemaViolation = validateAgainstSchema(
        stdout,
        testCase.expect.stdout.matchesSchema,
        doc,
      );
      if (schemaViolation) {
        violations.push({
          type: "stdout_schema_mismatch",
          message: schemaViolation,
          actual: stdout.slice(0, 200),
        });
      }
    }
  }

  if (testCase.expect.stderr) {
    if (testCase.expect.stderr.absent && stderr.trim().length > 0) {
      violations.push({
        type: "stderr_format_mismatch",
        message: "Expected no stderr, but got output",
        actual: stderr.slice(0, 200),
      });
    }
    if (testCase.expect.stderr.matchesSchema && doc) {
      const schemaViolation = validateAgainstSchema(
        stderr,
        testCase.expect.stderr.matchesSchema,
        doc,
      );
      if (schemaViolation) {
        violations.push({
          type: "stderr_schema_mismatch",
          message: schemaViolation,
          actual: stderr.slice(0, 200),
        });
      }
    }
  }

  return {
    id: testCase.id,
    status: violations.length === 0 ? "passed" : "failed",
    durationMs: Date.now() - startTime,
    violations: violations.length > 0 ? violations : undefined,
  };
}

function validateAgainstSchema(
  output: string,
  schemaRef: string,
  doc: CliContractsDocument,
): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return `Output is not valid JSON`;
  }

  const schema = resolveSchemaRef(schemaRef, doc);
  if (!schema) {
    return `Schema "${schemaRef}" not found`;
  }

  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  if (!validate(parsed)) {
    return `Schema validation failed: ${ajv.errorsText(validate.errors)}`;
  }

  return null;
}

function resolveSchemaRef(
  ref: string,
  doc: CliContractsDocument,
): Record<string, unknown> | null {
  if (!ref.startsWith("#/")) return null;
  const parts = ref.slice(2).split("/");
  let current: unknown = doc;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current as Record<string, unknown> | null;
}
