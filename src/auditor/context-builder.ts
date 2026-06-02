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

  for (const [setId, cs] of Object.entries(doc.command_sets)) {
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

  for (const [setId, cs] of Object.entries(doc.command_sets)) {
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
    `- Has breaking changes: ${diffResult.has_breaking_changes}\n` +
    `- Breaking count: ${diffResult.breaking_count ?? 0}\n` +
    `- Non-breaking count: ${diffResult.non_breaking_count ?? 0}`,
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
  "adapter", "model", "show-prompt", "fail-on", "output", "report-format",
] as const;

const REFERENCE_EXIT_CODES = ["0", "1", "10", "11", "12"] as const;

const REFERENCE_XAGENT_REQUIRED = ["safeDryRunOption"] as const;
const REFERENCE_XAGENT_RECOMMENDED = [
  "sideEffectNote", "expectedDurationMs", "retryableExitCodes",
] as const;

interface CommandPreAnalysis {
  command_id: string;
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
    command_id: cmdId, commandSetId: setId,
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

  for (const [setId, cs] of Object.entries(doc.command_sets)) {
    for (const [cmdId, cmd] of Object.entries(cs.commands)) {
      const cmdRecord = cmd as unknown as Record<string, unknown>;
      analyses.push(analyzeCommand(cmdId, setId, cmdRecord));
    }
  }

  sections.push(`## Total Commands: ${analyses.length}`);

  sections.push("## Deterministic Pre-Analysis");
  for (const a of analyses) {
    const lines: string[] = [`### Command: ${a.commandSetId}/${a.command_id}`];

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

// ─── Implementation Conformance Check ───────────────────────────

interface SourceFile {
  path: string;
  content: string;
}

export function buildImplementationCheckContext(
  doc: CliContractsDocument,
  contractYaml: string,
  sourceFiles: SourceFile[],
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Implementation Conformance Check");
  sections.push(`## Info\n- Title: ${doc.info.title}\n- Version: ${doc.info.version}`);

  sections.push(
    "## Objective\n" +
    "Verify that the CLI source code implementation conforms to the contract " +
    "specification. Check that every command, option, argument, exit code, and " +
    "effect declared in the contract is correctly implemented in the source code. " +
    "Also verify that the implementation does not contain undeclared commands or " +
    "behaviors that contradict the contract.",
  );

  sections.push("## Check Dimensions");
  sections.push([
    "| Dimension | What to check |",
    "|-----------|--------------|",
    "| Command coverage | Every contract command is registered in program.ts and has a handler |",
    "| Option conformance | Option names, types, defaults, and enums match between contract and code |",
    "| Exit code usage | Exit codes used in handlers match contract declarations |",
    "| Output schema | Stdout/stderr structure matches declared JSON schemas |",
    "| Effects accuracy | Declared effects (file I/O, network) match actual behavior |",
    "| Agent metadata | x-agent metadata (riskLevel, idempotent, sideEffects) reflects implementation |",
    "| Constraint enforcement | mutuallyExclusive and requiredTogether constraints enforced in code |",
    "| Undeclared behavior | No commands, options, or exit codes exist only in code but not in contract |",
  ].join("\n"));

  sections.push(
    "## Contract Specification\n```yaml\n" +
    contractYaml.substring(0, 50000) +
    (contractYaml.length > 50000 ? "\n# ... truncated ..." : "") +
    "\n```",
  );

  if (sourceFiles.length > 0) {
    sections.push("## Source Files");
    for (const file of sourceFiles) {
      const truncated = file.content.length > 20000
        ? file.content.substring(0, 20000) + "\n// ... truncated ..."
        : file.content;
      sections.push(`### ${file.path}\n\`\`\`typescript\n${truncated}\n\`\`\``);
    }
  } else {
    sections.push("## Source Files\n(No source files found. Check project structure.)");
  }

  sections.push(
    "## Expected Finding Categories\n" +
    "Use these categories for findings:\n" +
    "- `missing-command`: command in contract not found in implementation\n" +
    "- `undeclared-command`: command in implementation not in contract\n" +
    "- `option-mismatch`: option type/default/enum differs between contract and code\n" +
    "- `exit-code-violation`: handler uses exit code not declared in contract\n" +
    "- `schema-violation`: output structure doesn't match declared schema\n" +
    "- `effects-mismatch`: declared effects don't match actual behavior\n" +
    "- `metadata-inconsistency`: x-agent metadata contradicts implementation\n" +
    "- `constraint-violation`: declared constraints not enforced in code",
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

// ─── Bundle Configuration Generation ────────────────────────────

interface BundleSourceFile {
  path: string;
  content: string;
}

interface BundlePreAnalysis {
  entryPoint: string | null;
  packageName: string | null;
  binName: string | null;
  moduleType: string | null;
  hasDynamicRuntimeImports: boolean;
  hasRuntimePackageJsonRead: boolean;
  hasPolicyRuntimeRead: boolean;
  hasShebang: boolean;
  externalCandidates: string[];
  nativeModuleCandidates: string[];
}

function preAnalyzeBundle(files: BundleSourceFile[]): BundlePreAnalysis {
  const result: BundlePreAnalysis = {
    entryPoint: null,
    packageName: null,
    binName: null,
    moduleType: null,
    hasDynamicRuntimeImports: false,
    hasRuntimePackageJsonRead: false,
    hasPolicyRuntimeRead: false,
    hasShebang: false,
    externalCandidates: [],
    nativeModuleCandidates: [],
  };

  const KNOWN_LLM_SDKS = [
    "@anthropic-ai/claude-agent-sdk", "@anthropic-ai/sdk",
    "@cursor/sdk", "@openai/agents", "@google/genai",
  ];
  const KNOWN_NATIVE = [
    "better-sqlite3", "libpg-query", "puppeteer", "canvas", "sharp",
  ];

  for (const file of files) {
    if (file.path === "package.json") {
      try {
        const pkg = JSON.parse(file.content);
        result.packageName = pkg.name;
        result.moduleType = pkg.type ?? "commonjs";
        if (pkg.bin) {
          const binEntries = typeof pkg.bin === "string"
            ? { [pkg.name]: pkg.bin }
            : pkg.bin;
          const firstBin = Object.entries(binEntries)[0];
          if (firstBin) {
            result.binName = firstBin[0];
            result.entryPoint = (firstBin[1] as string)
              .replace(/^\.\/dist\//, "src/")
              .replace(/\.js$/, ".ts");
          }
        }
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
          ...pkg.optionalDependencies,
        };
        for (const dep of Object.keys(allDeps)) {
          if (KNOWN_LLM_SDKS.includes(dep)) {
            result.externalCandidates.push(dep);
          }
          if (KNOWN_NATIVE.includes(dep)) {
            result.nativeModuleCandidates.push(dep);
          }
        }
      } catch {
        // Invalid JSON
      }
    }

    if (file.content.includes('["agent-contracts"') && file.content.includes('.join("-")')) {
      result.hasDynamicRuntimeImports = true;
    }
    if (file.content.includes('require("../package.json")') ||
        file.content.includes("require('../package.json')")) {
      result.hasRuntimePackageJsonRead = true;
    }
    if (file.content.includes("policy-runtime.ts") && file.content.includes("readFileSync")) {
      result.hasPolicyRuntimeRead = true;
    }
    if (file.content.startsWith("#!/")) {
      result.hasShebang = true;
    }
  }

  return result;
}

export function buildBundleContext(
  files: BundleSourceFile[],
  referenceTemplate: string,
): string {
  const sections: string[] = [];

  sections.push("# CLI Contract: Bundle Configuration Generation");

  const analysis = preAnalyzeBundle(files);

  sections.push("## Objective");
  sections.push(
    "Generate a complete `esbuild.bundle.mjs` build script that produces a " +
    "single-file CLI bundle for this project. The script must handle all " +
    "identified patterns (dynamic imports, version inlining, shebang handling) " +
    "using esbuild plugins.",
  );

  sections.push("## Deterministic Pre-Analysis");
  sections.push([
    `- Package: ${analysis.packageName ?? "(unknown)"}`,
    `- Entry point: ${analysis.entryPoint ?? "(not detected)"}`,
    `- Bin name: ${analysis.binName ?? "(not detected)"}`,
    `- Module type: ${analysis.moduleType ?? "(not detected)"}`,
    `- Has obfuscated runtime imports: ${analysis.hasDynamicRuntimeImports}`,
    `- Has runtime package.json read: ${analysis.hasRuntimePackageJsonRead}`,
    `- Has policy-runtime file read: ${analysis.hasPolicyRuntimeRead}`,
    `- Has shebang: ${analysis.hasShebang}`,
    `- External candidates (LLM SDKs): ${analysis.externalCandidates.join(", ") || "(none)"}`,
    `- Native module candidates: ${analysis.nativeModuleCandidates.join(", ") || "(none)"}`,
  ].join("\n"));

  sections.push("## Reference Template");
  sections.push(
    "This is the canonical esbuild.bundle.mjs from cli-contracts itself. " +
    "Adapt it to the target project's specific patterns.\n" +
    "```javascript\n" + referenceTemplate + "\n```",
  );

  sections.push("## Source Files");
  for (const file of files) {
    if (file.path === "package.json") continue;
    const truncated = file.content.length > 15000
      ? file.content.substring(0, 15000) + "\n// ... truncated ..."
      : file.content;
    sections.push(`### ${file.path}\n\`\`\`typescript\n${truncated}\n\`\`\``);
  }

  const pkgFile = files.find((f) => f.path === "package.json");
  if (pkgFile) {
    sections.push(`### package.json\n\`\`\`json\n${pkgFile.content}\n\`\`\``);
  }

  sections.push(
    "## Output Requirements\n" +
    "Return the complete `esbuild.bundle.mjs` as a finding with:\n" +
    "- `category`: `bundle-config`\n" +
    "- `severity`: `info`\n" +
    "- `evidence[0].kind`: `file`\n" +
    "- `evidence[0].target`: `esbuild.bundle.mjs`\n" +
    "- `evidence[0].excerpt`: the complete script content\n\n" +
    "Also include findings for each detected pattern and the plugin used to handle it.",
  );

  return sections.join("\n\n");
}
