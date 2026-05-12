import type {
  Command,
  Option,
  Effects,
  EnvVar,
  RiskLevel,
  ExecutionMode,
} from "./schema.js";

// ─── Derived Policy Types ───────────────────────────────────────

export type DerivedReadEffect =
  | { kind: "option-file"; option: string; path?: string; source: string }
  | { kind: "semantic"; target: string; description?: string; source: string };

export type DerivedWriteEffect =
  | {
      kind: "option-file";
      option: string;
      path?: string;
      mode: string;
      source: string;
    }
  | {
      kind: "semantic";
      target: string;
      description?: string;
      overwrite?: boolean;
      destructive?: boolean;
      source: string;
    };

export interface DerivedPolicy {
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  sideEffects: string[];
  reads: DerivedReadEffect[];
  writes: DerivedWriteEffect[];
  executionMode?: ExecutionMode;
  requiresSecrets?: string[];
}

export interface OptionInput {
  value: unknown;
  specified: boolean;
}

export interface PolicyDerivationInput {
  commandId: string;
  commandEffects?: Effects;
  options: Record<
    string,
    OptionInput & { definition: Option }
  >;
  env?: Record<string, EnvVar>;
}

// ─── Risk Level Ordering ────────────────────────────────────────

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function maxRiskLevel(...levels: RiskLevel[]): RiskLevel {
  let max: RiskLevel = "low";
  for (const level of levels) {
    if (RISK_ORDER[level] > RISK_ORDER[max]) {
      max = level;
    }
  }
  return max;
}

// ─── Active Determination ───────────────────────────────────────

export function isOptionActive(
  definition: Option,
  value: unknown,
  specified: boolean,
): boolean {
  const schemaType = definition.schema?.type;

  if (schemaType === "boolean") {
    return value === true;
  }

  if (definition.repeatable) {
    return specified && Array.isArray(value) && value.length > 0;
  }

  // string, number, integer, or any non-boolean type
  return specified && value != null;
}

// ─── Derive Policy ─────────────────────────────────────────────

export function derivePolicy(input: PolicyDerivationInput): DerivedPolicy {
  const sideEffects = new Set<string>();
  const reads: DerivedReadEffect[] = [];
  const writes: DerivedWriteEffect[] = [];
  const riskLevels: RiskLevel[] = [];
  let executionMode: ExecutionMode | undefined;
  let explicitConfirmation: boolean | undefined;

  // 1. Command base effects (always apply)
  if (input.commandEffects) {
    const ce = input.commandEffects;
    riskLevels.push(ce.riskLevel ?? "low");

    if (ce.writes) {
      sideEffects.add("file_write");
      for (const w of ce.writes) {
        writes.push({
          kind: "semantic",
          target: w.target,
          description: w.description,
          overwrite: w.overwrite,
          destructive: w.destructive,
          source: `command:${input.commandId}`,
        });
      }
    }

    if (ce.reads) {
      for (const r of ce.reads) {
        reads.push({
          kind: "semantic",
          target: r.target,
          description: r.description,
          source: `command:${input.commandId}`,
        });
      }
    }

    if (ce.network) {
      sideEffects.add("network");
    }

    if (ce.executionMode) {
      executionMode = ce.executionMode;
    }

    if (ce.requiresConfirmation !== undefined) {
      explicitConfirmation = ce.requiresConfirmation;
    }
  }

  // 2. Active options' effects
  for (const [optName, optInput] of Object.entries(input.options)) {
    const { definition, value, specified } = optInput;
    const active = isOptionActive(definition, value, specified);
    if (!active) continue;

    // file contract → option-file reads/writes
    if (definition.file) {
      const filePath =
        typeof value === "string" ? value : undefined;
      const mode = definition.file.mode;

      if (mode === "read" || mode === "readWrite") {
        reads.push({
          kind: "option-file",
          option: optName,
          path: filePath,
          source: `option:${optName}`,
        });
      }
      if (mode === "write" || mode === "append" || mode === "readWrite") {
        sideEffects.add("file_write");
        writes.push({
          kind: "option-file",
          option: optName,
          path: filePath,
          mode,
          source: `option:${optName}`,
        });
      }
    }

    // effects block
    if (definition.effects) {
      const eff = definition.effects;
      riskLevels.push(eff.riskLevel ?? "low");

      if (eff.writes) {
        sideEffects.add("file_write");
        for (const w of eff.writes) {
          writes.push({
            kind: "semantic",
            target: w.target,
            description: w.description,
            overwrite: w.overwrite,
            destructive: w.destructive,
            source: `option:${optName}`,
          });
        }
      }

      if (eff.reads) {
        for (const r of eff.reads) {
          reads.push({
            kind: "semantic",
            target: r.target,
            description: r.description,
            source: `option:${optName}`,
          });
        }
      }

      if (eff.network) {
        sideEffects.add("network");
      }

      if (eff.executionMode && !executionMode) {
        executionMode = eff.executionMode;
      }

      if (eff.requiresConfirmation !== undefined && explicitConfirmation === undefined) {
        explicitConfirmation = eff.requiresConfirmation;
      }
    }
  }

  // 3. riskLevel = max(command, ...activeOptions)
  const finalRiskLevel =
    riskLevels.length > 0 ? maxRiskLevel(...riskLevels) : "low";

  // 4. requiresConfirmation
  const requiresConfirmation =
    explicitConfirmation ??
    (finalRiskLevel === "high" || finalRiskLevel === "critical");

  // 5. requiresSecrets from env[].sensitive
  let requiresSecrets: string[] | undefined;
  if (input.env) {
    const secrets: string[] = [];
    for (const [envName, envVar] of Object.entries(input.env)) {
      if (envVar.sensitive) {
        secrets.push(envName);
      }
    }
    if (secrets.length > 0) {
      requiresSecrets = secrets;
    }
  }

  return {
    riskLevel: finalRiskLevel,
    requiresConfirmation,
    sideEffects: [...sideEffects],
    reads,
    writes,
    ...(executionMode ? { executionMode } : {}),
    ...(requiresSecrets ? { requiresSecrets } : {}),
  };
}

// ─── Introspection Output ───────────────────────────────────────

export interface IntrospectionResult {
  command: string;
  activeOptions: string[];
  policy: DerivedPolicy;
}

/**
 * Build introspection result from a command definition and parsed option values.
 * Used by generated --introspect handlers.
 */
export function buildIntrospection(
  commandId: string,
  command: Command,
  optionValues: Record<string, unknown>,
  env?: Record<string, EnvVar>,
): IntrospectionResult {
  const commandEffects = (command as Record<string, unknown>).effects as
    | Effects
    | undefined;

  const options: PolicyDerivationInput["options"] = {};
  const activeOptions: string[] = [];

  for (const opt of command.options ?? []) {
    const value = optionValues[opt.name];
    const specified = opt.name in optionValues && value !== undefined;
    options[opt.name] = { value, specified, definition: opt };

    if (isOptionActive(opt, value, specified)) {
      activeOptions.push(opt.name);
    }
  }

  const policy = derivePolicy({
    commandId,
    commandEffects,
    options,
    env,
  });

  return { command: commandId, activeOptions, policy };
}
