/**
 * Semantic validator for CLI Contracts documents.
 *
 * Structural validation (required fields, types, value constraints) is
 * handled by the Zod schema in schema.ts at parse time. This module
 * performs higher-level semantic checks that cannot be expressed in
 * a JSON Schema / Zod schema:
 *
 *  - duplicate command paths within a command set
 *  - duplicate argument / option names
 *  - duplicate option aliases
 *  - variadic argument placement
 *  - exit code range (0-255)
 *  - stream schema vs framing conflict
 *  - unresolved $ref targets
 *  - empty command set warnings
 */

import type {
  CliContractsDocument,
  CommandSet,
  Command,
  Option,
  Argument,
  Diagnostic,
  ValidateResult,
} from "./types.js";
import { XAgentSchema, EffectsSchema } from "./schema.js";
import type { Effects } from "./schema.js";
import { validateRefs } from "./ref-resolver.js";
import { derivePolicy, isOptionActive } from "./policy.js";

export function validateContract(
  doc: CliContractsDocument,
  options: { basePath?: string } = {},
): ValidateResult {
  const diagnostics: Diagnostic[] = [];

  validateCommandSets(doc, diagnostics);
  validateRefsIntegrity(doc, diagnostics, options.basePath);

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  return {
    valid: errors.length === 0,
    error_count: errors.length,
    warning_count: warnings.length,
    errors,
    warnings,
  };
}

export function validateXAgent(
  xAgent: unknown,
  basePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const path = `${basePath}/x-agent`;

  if (typeof xAgent !== "object" || xAgent === null) {
    diagnostics.push({
      path,
      message: "x-agent must be an object",
      rule: "xagent-invalid-type",
      severity: "error",
    });
    return diagnostics;
  }

  const parsed = XAgentSchema.safeParse(xAgent);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({
        path: `${path}/${issue.path.join("/")}`,
        message: issue.message,
        rule: "xagent-schema-error",
        severity: "error",
      });
    }
    return diagnostics;
  }

  const data = parsed.data;

  if (
    (data.risk_level === "high" || data.risk_level === "critical") &&
    data.requires_confirmation !== true
  ) {
    diagnostics.push({
      path,
      message: `risk_level is "${data.risk_level}" but requires_confirmation is not true`,
      rule: "xagent-high-risk-no-confirmation",
      severity: "warning",
    });
  }

  if (
    data.side_effects &&
    data.side_effects.length > 0 &&
    data.idempotent === undefined
  ) {
    diagnostics.push({
      path,
      message: "Command has side_effects but idempotent is not declared",
      rule: "xagent-side-effects-no-idempotent",
      severity: "warning",
    });
  }

  return diagnostics;
}

function validateCommandSets(
  doc: CliContractsDocument,
  diagnostics: Diagnostic[],
): void {
  for (const setId of Object.keys(doc.command_sets)) {
    const basePath = `/command_sets/${setId}`;
    const cs = doc.command_sets[setId];

    if (cs.global_options) {
      validateOptions(cs.global_options, `${basePath}/global_options`, diagnostics);
    }

    validateCommands(doc, cs, setId, basePath, diagnostics);
  }
}

function validateCommands(
  doc: CliContractsDocument,
  cs: CommandSet,
  setId: string,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const cmdIds = Object.keys(cs.commands);
  if (cmdIds.length === 0) {
    diagnostics.push({
      path: `${basePath}/commands`,
      message: `Command set "${setId}" has no commands`,
      rule: "empty-commands",
      severity: "warning",
    });
    return;
  }

  const pathMap = new Map<string, string>();
  for (const cmdId of cmdIds) {
    const cmd = cs.commands[cmdId];
    const cmdPath = (cmd.path ?? cmdId.split(".")).join(" ");
    if (pathMap.has(cmdPath)) {
      diagnostics.push({
        path: `${basePath}/commands/${cmdId}`,
        message: `Duplicate command path "${cmdPath}" (conflicts with "${pathMap.get(cmdPath)}")`,
        rule: "duplicate-command-path",
        severity: "error",
      });
    } else {
      pathMap.set(cmdPath, cmdId);
    }

    validateCommand(
      doc,
      cmd,
      cmdId,
      `${basePath}/commands/${cmdId}`,
      diagnostics,
    );
  }
}

function validateCommand(
  doc: CliContractsDocument,
  cmd: Command,
  _cmdId: string,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  validateExits(cmd, basePath, diagnostics);

  if (cmd.arguments) {
    validateArguments(cmd.arguments, basePath, diagnostics);
  }

  if (cmd.options) {
    validateOptions(cmd.options, `${basePath}/options`, diagnostics);
  }

  if (cmd.streams) {
    validateStreams(cmd, basePath, diagnostics);
  }

  const xAgent = (cmd as Record<string, unknown>)["x-agent"];
  if (xAgent !== undefined) {
    diagnostics.push(...validateXAgent(xAgent, basePath));
  }

  if (cmd.effects || cmd.options?.some((o) => o.effects)) {
    diagnostics.push(...validateEffectsConsistency(cmd, _cmdId, basePath));
  }

  if (xAgent !== undefined && (cmd.effects || cmd.options?.some((o) => o.effects))) {
    diagnostics.push(
      ...validateXAgentDeprecation(xAgent as Record<string, unknown>, basePath),
    );
  }

  diagnostics.push(...validateMemoryRef(cmd, basePath));

  validateSlotReferences(doc, cmd, basePath, diagnostics);
}

export function validateMemoryRef(
  cmd: Command,
  basePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const memoryRef = cmd.memory_ref;
  if (!memoryRef?.output) {
    return diagnostics;
  }

  const xAgent = (cmd as Record<string, unknown>)["x-agent"];
  if (commandDeclaresSideEffects(cmd, xAgent)) {
    return diagnostics;
  }

  diagnostics.push({
    path: `${basePath}/memory_ref`,
    message:
      "memory_ref.output is true but no side-effect declaration found; declare effects or x-agent side_effects for external memory store writes",
    rule: "memory-ref-output-no-side-effects",
    severity: "warning",
  });
  return diagnostics;
}

function commandDeclaresSideEffects(
  cmd: Command,
  xAgent: unknown,
): boolean {
  if (xAgent && typeof xAgent === "object" && xAgent !== null) {
    const agent = xAgent as Record<string, unknown>;
    if (Array.isArray(agent.side_effects) && agent.side_effects.length > 0) {
      return true;
    }
    if (Array.isArray(agent.writes) && agent.writes.length > 0) {
      return true;
    }
  }

  const effects = cmd.effects;
  if (!effects) {
    return false;
  }

  if (effects.writes && effects.writes.length > 0) {
    return true;
  }
  if (effects.reads && effects.reads.length > 0) {
    return true;
  }
  if (effects.network === true) {
    return true;
  }
  if (typeof effects.network === "object" && effects.network !== null) {
    return true;
  }
  if (effects.risk_level) {
    return true;
  }
  if (effects.description) {
    return true;
  }

  return false;
}

function effectsUseSlotReferences(effects: Effects): boolean {
  if (effects.reads?.length && typeof effects.reads[0] === "string") {
    return true;
  }
  if (effects.writes?.length && typeof effects.writes[0] === "string") {
    return true;
  }
  return false;
}

function validateSlotReferences(
  doc: CliContractsDocument,
  cmd: Command,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const effects = cmd.effects;
  if (!effects) return;

  if (!doc.artifact_slots) {
    if (effectsUseSlotReferences(effects)) {
      diagnostics.push({
        path: `${basePath}/effects`,
        message:
          "Effects use slot references but artifact_slots is not declared on the document",
        rule: "slot-reference-without-artifact-slots",
        severity: "warning",
      });
    }
    return;
  }

  const slotNames = new Set(Object.keys(doc.artifact_slots));

  if (
    effects.reads &&
    effects.reads.length > 0 &&
    typeof effects.reads[0] === "string"
  ) {
    for (const slot of effects.reads as string[]) {
      if (!slotNames.has(slot)) {
        diagnostics.push({
          path: `${basePath}/effects/reads`,
          message: `Slot reference "${slot}" not found in artifact_slots`,
          rule: "undefined-slot-reference",
          severity: "error",
        });
      }
    }
  }

  if (
    effects.writes &&
    effects.writes.length > 0 &&
    typeof effects.writes[0] === "string"
  ) {
    for (const slot of effects.writes as string[]) {
      if (!slotNames.has(slot)) {
        diagnostics.push({
          path: `${basePath}/effects/writes`,
          message: `Slot reference "${slot}" not found in artifact_slots`,
          rule: "undefined-slot-reference",
          severity: "error",
        });
      }
    }
  }
}

function validateExits(
  cmd: Command,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  for (const [code] of Object.entries(cmd.exits)) {
    const numCode = Number(code);
    if (!Number.isInteger(numCode) || numCode < 0 || numCode > 255) {
      diagnostics.push({
        path: `${basePath}/exits/${code}`,
        message: `Invalid exit code "${code}" (must be integer 0-255)`,
        rule: "invalid-exit-code",
        severity: "error",
      });
    }
  }
}

function validateArguments(
  args: Argument[],
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const argNames = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const argPath = `${basePath}/arguments/${i}`;

    if (argNames.has(arg.name)) {
      diagnostics.push({
        path: argPath,
        message: `Duplicate argument name "${arg.name}"`,
        rule: "duplicate-argument-name",
        severity: "error",
      });
    }
    argNames.add(arg.name);

    if (arg.variadic && i < args.length - 1) {
      diagnostics.push({
        path: argPath,
        message: `Variadic argument "${arg.name}" must be the last argument`,
        rule: "variadic-not-last",
        severity: "error",
      });
    }
  }
}

function validateOptions(
  opts: Option[],
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const optNames = new Set<string>();
  const aliasMap = new Map<string, string>();

  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i];
    const optPath = `${basePath}/${i}`;

    if (optNames.has(opt.name)) {
      diagnostics.push({
        path: optPath,
        message: `Duplicate option name "${opt.name}"`,
        rule: "duplicate-option-name",
        severity: "error",
      });
    }
    optNames.add(opt.name);

    if (opt.aliases) {
      for (const alias of opt.aliases) {
        if (aliasMap.has(alias)) {
          diagnostics.push({
            path: optPath,
            message: `Duplicate alias "${alias}" (already used by "${aliasMap.get(alias)}")`,
            rule: "duplicate-option-alias",
            severity: "error",
          });
        } else {
          aliasMap.set(alias, opt.name);
        }
      }
    }
  }
}

function validateStreams(
  cmd: Command,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const streams = cmd.streams!;
  for (const [key, stream] of Object.entries(streams)) {
    if (!stream) continue;
    const streamPath = `${basePath}/streams/${key}`;

    if (stream.framing && stream.schema) {
      diagnostics.push({
        path: streamPath,
        message: `Stream "${key}" has both "framing" and "schema"; use "item_schema" with framing`,
        rule: "stream-schema-conflict",
        severity: "warning",
      });
    }
  }
}

const DEPRECATED_XAGENT_FIELDS: Record<string, string> = {
  risk_level: "effects.risk_level + max aggregation",
  side_effects: "effects.writes / effects.network + file.mode",
  sideEffectNote: "effects.writes[].description",
  requires_confirmation: "risk_level >= high (auto-derived from effects)",
  requiresConfirmationWhen: "option-level effects",
  dangerousOptions: "option-level effects.risk_level",
  safe_dry_run_option: "--introspect global option",
  requires_network: "effects.network",
  requires_secrets: "env[].sensitive",
  reads: "effects.reads / file.mode",
  writes: "effects.writes / file.mode",
  idempotent: "effects.writes[].idempotent / effects.network.idempotent",
  idempotent_note: "effects.writes[].idempotent_note / effects.network.idempotent_note",
};

const RISK_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function validateXAgentDeprecation(
  xAgent: Record<string, unknown>,
  basePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const path = `${basePath}/x-agent`;

  for (const [field, replacement] of Object.entries(DEPRECATED_XAGENT_FIELDS)) {
    if (field in xAgent) {
      diagnostics.push({
        path: `${path}/${field}`,
        message: `x-agent.${field} is deprecated when effects are declared; use ${replacement} instead`,
        rule: "xagent-deprecated-field",
        severity: "warning",
      });
    }
  }

  return diagnostics;
}

export function validateEffectsConsistency(
  cmd: Command,
  cmdId: string,
  basePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const xAgent = (cmd as Record<string, unknown>)["x-agent"] as
    | Record<string, unknown>
    | undefined;
  if (!xAgent) return diagnostics;

  const cmdEffects = cmd.effects;
  const riskLevels: string[] = [];

  if (cmdEffects?.risk_level) {
    riskLevels.push(cmdEffects.risk_level);
  }
  for (const opt of cmd.options ?? []) {
    if (opt.effects?.risk_level) {
      riskLevels.push(opt.effects.risk_level);
    }
  }

  if (riskLevels.length > 0 && typeof xAgent.risk_level === "string") {
    const derivedMax = riskLevels.reduce((a, b) =>
      (RISK_ORDER[a] ?? 0) >= (RISK_ORDER[b] ?? 0) ? a : b,
    );
    const xAgentRisk = xAgent.risk_level as string;
    if (
      derivedMax in RISK_ORDER &&
      xAgentRisk in RISK_ORDER &&
      (RISK_ORDER[derivedMax] ?? 0) > (RISK_ORDER[xAgentRisk] ?? 0)
    ) {
      diagnostics.push({
        path: `${basePath}/x-agent/risk_level`,
        message: `x-agent.risk_level "${xAgentRisk}" contradicts effects-derived risk_level "${derivedMax}"`,
        rule: "xagent-effects-contradiction",
        severity: "error",
      });
    }
  }

  return diagnostics;
}

function validateRefsIntegrity(
  doc: CliContractsDocument,
  diagnostics: Diagnostic[],
  basePath?: string,
): void {
  const { unresolvedRefs } = validateRefs(doc, { basePath });
  for (const ref of unresolvedRefs) {
    diagnostics.push({
      path: ref,
      message: `Unresolved $ref "${ref}"`,
      rule: "unresolved-ref",
      severity: "error",
    });
  }
}
