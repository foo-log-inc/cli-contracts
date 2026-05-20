import type {
  Command,
  Option,
  Effects,
  EnvVar,
  RiskLevel,
  ExecutionMode,
  EffectWrite,
  EffectRead,
} from "./schema.js";

function isEffectWriteArray(
  items: string[] | EffectWrite[] | undefined,
): items is EffectWrite[] {
  return (
    items !== undefined && items.length > 0 && typeof items[0] !== "string"
  );
}

function isEffectReadArray(
  items: string[] | EffectRead[] | undefined,
): items is EffectRead[] {
  return (
    items !== undefined && items.length > 0 && typeof items[0] !== "string"
  );
}

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
      idempotent?: boolean;
      idempotency_key?: string;
      idempotent_note?: string;
      source: string;
    };

export interface DerivedNetworkEffect {
  description?: string;
  domains?: string[];
  idempotent?: boolean;
  idempotency_key?: string;
  idempotent_note?: string;
  source: string;
}

export interface DerivedPolicy {
  risk_level: RiskLevel;
  requires_confirmation: boolean;
  idempotent: boolean;
  side_effects: string[];
  reads: DerivedReadEffect[];
  writes: DerivedWriteEffect[];
  network?: DerivedNetworkEffect[];
  execution_mode?: ExecutionMode;
  requires_secrets?: string[];
}

export interface OptionInput {
  value: unknown;
  specified: boolean;
}

export interface PolicyDerivationInput {
  command_id: string;
  command_effects?: Effects;
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
  const networkEffects: DerivedNetworkEffect[] = [];
  const riskLevels: RiskLevel[] = [];
  let executionMode: ExecutionMode | undefined;
  let explicitConfirmation: boolean | undefined;

  // 1. Command base effects (always apply)
  if (input.command_effects) {
    const ce = input.command_effects;
    riskLevels.push(ce.risk_level ?? "low");

    if (isEffectWriteArray(ce.writes)) {
      sideEffects.add("file_write");
      for (const w of ce.writes) {
        writes.push({
          kind: "semantic",
          target: w.target,
          description: w.description,
          overwrite: w.overwrite,
          destructive: w.destructive,
          ...(w.idempotent !== undefined ? { idempotent: w.idempotent } : {}),
          ...(w.idempotency_key ? { idempotency_key: w.idempotency_key } : {}),
          ...(w.idempotent_note ? { idempotent_note: w.idempotent_note } : {}),
          source: `command:${input.command_id}`,
        });
      }
    }

    if (isEffectReadArray(ce.reads)) {
      for (const r of ce.reads) {
        reads.push({
          kind: "semantic",
          target: r.target,
          description: r.description,
          source: `command:${input.command_id}`,
        });
      }
    }

    if (ce.network) {
      sideEffects.add("network");
      if (typeof ce.network === "object") {
        networkEffects.push({
          ...(ce.network.description ? { description: ce.network.description } : {}),
          ...(ce.network.domains ? { domains: ce.network.domains } : {}),
          ...(ce.network.idempotent !== undefined ? { idempotent: ce.network.idempotent } : {}),
          ...(ce.network.idempotency_key ? { idempotency_key: ce.network.idempotency_key } : {}),
          ...(ce.network.idempotent_note ? { idempotent_note: ce.network.idempotent_note } : {}),
          source: `command:${input.command_id}`,
        });
      }
    }

    if (ce.execution_mode) {
      executionMode = ce.execution_mode;
    }

    if (ce.requires_confirmation !== undefined) {
      explicitConfirmation = ce.requires_confirmation;
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
      riskLevels.push(eff.risk_level ?? "low");

      if (isEffectWriteArray(eff.writes)) {
        sideEffects.add("file_write");
        for (const w of eff.writes) {
          writes.push({
            kind: "semantic",
            target: w.target,
            description: w.description,
            overwrite: w.overwrite,
            destructive: w.destructive,
            ...(w.idempotent !== undefined ? { idempotent: w.idempotent } : {}),
            ...(w.idempotency_key ? { idempotency_key: w.idempotency_key } : {}),
            ...(w.idempotent_note ? { idempotent_note: w.idempotent_note } : {}),
            source: `option:${optName}`,
          });
        }
      }

      if (isEffectReadArray(eff.reads)) {
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
        if (typeof eff.network === "object") {
          networkEffects.push({
            ...(eff.network.description ? { description: eff.network.description } : {}),
            ...(eff.network.domains ? { domains: eff.network.domains } : {}),
            ...(eff.network.idempotent !== undefined ? { idempotent: eff.network.idempotent } : {}),
            ...(eff.network.idempotency_key ? { idempotency_key: eff.network.idempotency_key } : {}),
            ...(eff.network.idempotent_note ? { idempotent_note: eff.network.idempotent_note } : {}),
            source: `option:${optName}`,
          });
        }
      }

      if (eff.execution_mode && !executionMode) {
        executionMode = eff.execution_mode;
      }

      if (eff.requires_confirmation !== undefined && explicitConfirmation === undefined) {
        explicitConfirmation = eff.requires_confirmation;
      }
    }
  }

  // 3. risk_level = max(command, ...active options)
  const finalRiskLevel =
    riskLevels.length > 0 ? maxRiskLevel(...riskLevels) : "low";

  // 4. requires_confirmation
  const requiresConfirmation =
    explicitConfirmation ??
    (finalRiskLevel === "high" || finalRiskLevel === "critical");

  // 5. requires_secrets from env[].sensitive
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

  // 6. idempotent = all semantic writes idempotent AND all network effects idempotent
  const semanticWrites = writes.filter((w) => w.kind === "semantic");
  const idempotent =
    semanticWrites.every((w) => w.idempotent === true) &&
    networkEffects.every((n) => n.idempotent === true);

  return {
    risk_level: finalRiskLevel,
    requires_confirmation: requiresConfirmation,
    idempotent,
    side_effects: [...sideEffects],
    reads,
    writes,
    ...(networkEffects.length > 0 ? { network: networkEffects } : {}),
    ...(executionMode ? { execution_mode: executionMode } : {}),
    ...(requiresSecrets ? { requires_secrets: requiresSecrets } : {}),
  };
}

// ─── Introspection Output ───────────────────────────────────────

export interface IntrospectionResult {
  command: string;
  active_options: string[];
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
    command_id: commandId,
    command_effects: commandEffects,
    options,
    env,
  });

  return { command: commandId, active_options: activeOptions, policy };
}
