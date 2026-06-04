// ─── Contract & Config Types (derived from Zod schemas) ────────
//
// All document and config types are inferred from Zod schemas in
// schema.ts. Re-exported here for backward compatibility.

export type {
  CliContractsDocument,
  Info,
  CommandSet,
  Command,
  Argument,
  Option,
  FileContract,
  CsvMetadata,
  Exit,
  OutputContract,
  GeneratedFile,
  Streams,
  StreamContract,
  Framing,
  Signal,
  Example,
  DeprecationInfo,
  Components,
  EnvVar,
  JsonSchema,
  CliContractsConfig,
  InputConfig,
  ValidationConfig,
  ExecutionProfile,
  ExecutionProfileCommandSet,
  GeneratorConfig,
  ContractTestsConfig,
  DiffConfig,
  XAgent,
  HumanReview,
  Rollback,
  RiskLevel,
  ExecutionMode,
  SlotDirection,
  ArtifactSlot,
  EffectWrite,
  EffectRead,
  NetworkEffect,
  Effects,
  MemoryRef,
  MemoryRefSpec,
} from "./schema.js";

// ─── Normalized Context (for generators) ────────────────────────

export interface NormalizedContext {
  spec_version: string;
  info: import("./schema.js").Info;
  command_sets: NormalizedCommandSet[];
  components: import("./schema.js").Components;
}

export interface NormalizedCommandSet {
  id: string;
  executable: string;
  summary?: string;
  description?: string;
  global_options: import("./schema.js").Option[];
  env: Record<string, import("./schema.js").EnvVar>;
  commands: NormalizedCommand[];
  extensions: Record<string, unknown>;
}

export interface NormalizedCommand {
  id: string;
  full_id: string;
  path: string[];
  invocation: string;
  summary: string;
  description?: string;
  usage?: string[];
  arguments: import("./schema.js").Argument[];
  options: import("./schema.js").Option[];
  all_options: import("./schema.js").Option[];
  effects?: import("./schema.js").Effects;
  streams?: import("./schema.js").Streams;
  signals?: Record<string, import("./schema.js").Signal>;
  exits: NormalizedExit[];
  examples?: import("./schema.js").Example[];
  deprecated?: import("./schema.js").DeprecationInfo;
  extensions: Record<string, unknown>;
}

export interface NormalizedExit {
  exit_code: number;
  description: string;
  stdout?: import("./schema.js").OutputContract;
  stderr?: import("./schema.js").OutputContract;
  files?: import("./schema.js").GeneratedFile[];
}

// ─── Validation Result Types ────────────────────────────────────

export interface Diagnostic {
  path: string;
  message: string;
  rule: string;
  severity: "error" | "warning";
}

export interface ValidateResult {
  valid: boolean;
  error_count: number;
  warning_count: number;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

// ─── Generator Result Types ─────────────────────────────────────

export interface GeneratorOutput {
  name: string;
  status: "success" | "skipped" | "failed";
  files: string[];
  error?: string;
}

export interface GenerateResult {
  generators: GeneratorOutput[];
}

// ─── Diff Result Types ──────────────────────────────────────────

export interface DiffChange {
  type: "added" | "removed" | "changed";
  path: string;
  breaking: boolean;
  description: string;
}

export interface DiffResult {
  has_breaking_changes: boolean;
  breaking_count: number;
  non_breaking_count: number;
  changes: DiffChange[];
}
