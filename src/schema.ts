import { z } from "zod";

// ─── JSON Schema utility type ───────────────────────────────────

/**
 * TypeScript representation of an embedded JSON Schema.
 * Covers the subset of JSON Schema properties commonly used in
 * CLI Contracts, with an index signature for anything else.
 */
export type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  format?: string;
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
};

// ─── Primitives ─────────────────────────────────────────────────

/**
 * Embedded JSON Schema — validated as a plain object at runtime.
 * Full JSON Schema validation is out of scope; we only enforce
 * that it is a non-null object. The output is typed as JsonSchema
 * for downstream convenience.
 */
export const JsonSchemaSchema: z.ZodType<JsonSchema> = z
  .record(z.string(), z.unknown()) as z.ZodType<JsonSchema>;

// ─── Contract Document Schemas ──────────────────────────────────

export const CsvMetadataSchema = z.object({
  delimiter: z.string().optional(),
  quote_char: z.string().optional(),
  header_rows: z.number().int().optional(),
  footer_rows: z.number().int().optional(),
});

export const FileContractSchema = z.object({
  mode: z.enum(["read", "write", "append", "readWrite"]),
  exists: z.boolean().optional(),
  media_type: z.string().optional(),
  encoding: z.string().optional(),
  schema: JsonSchemaSchema.optional(),
  csv: CsvMetadataSchema.optional(),
});

export const ArgumentSchema = z.object({
  name: z.string().min(1, "Argument name must not be empty"),
  index: z.number().int().nonnegative().optional(),
  required: z.boolean().optional(),
  description: z.string().optional(),
  schema: JsonSchemaSchema.optional(),
  file: FileContractSchema.optional(),
  variadic: z.boolean().optional(),
});

// ─── Effects Schema ─────────────────────────────────────────────

export const RiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const ExecutionModeSchema = z.enum([
  "normal",
  "long-running",
  "watch",
  "interactive",
  "background",
]);

export const EffectWriteSchema = z.object({
  target: z.string().min(1),
  description: z.string().optional(),
  overwrite: z.boolean().optional(),
  destructive: z.boolean().optional(),
  idempotent: z.boolean().optional(),
  idempotency_key: z.string().optional(),
  idempotent_note: z.string().optional(),
});

export const EffectReadSchema = z.object({
  target: z.string().min(1),
  description: z.string().optional(),
});

export const SlotDirectionSchema = z.enum(["read", "write", "readwrite"]);

export const ArtifactSlotSchema = z.object({
  description: z.string().optional(),
  direction: SlotDirectionSchema,
});

export const NetworkEffectSchema = z.union([
  z.boolean(),
  z.object({
    description: z.string().optional(),
    domains: z.array(z.string()).optional(),
    requires_secrets: z.array(z.string()).optional(),
    idempotent: z.boolean().optional(),
    idempotency_key: z.string().optional(),
    idempotent_note: z.string().optional(),
  }),
]);

export const EffectsSchema = z.object({
  risk_level: RiskLevelSchema.optional(),
  reads: z
    .union([z.array(z.string()), z.array(EffectReadSchema)])
    .optional(),
  writes: z
    .union([z.array(z.string()), z.array(EffectWriteSchema)])
    .optional(),
  network: NetworkEffectSchema.optional(),
  execution_mode: ExecutionModeSchema.optional(),
  requires_confirmation: z.boolean().optional(),
  description: z.string().optional(),
  overwrites: z.boolean().optional(),
});

// ─── Option / Output Schemas ────────────────────────────────────

export const OptionSchema = z.object({
  name: z.string().min(1, "Option name must not be empty"),
  aliases: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  value_name: z.string().optional(),
  description: z.string().optional(),
  schema: JsonSchemaSchema.optional(),
  file: FileContractSchema.optional(),
  effects: EffectsSchema.optional(),
  repeatable: z.boolean().optional(),
  deprecated: z
    .object({
      since: z.string().optional(),
      message: z.string().optional(),
      alternative: z.string().optional(),
    })
    .optional(),
});

export const OutputContractSchema = z.object({
  required: z.boolean().optional(),
  format: z.string().min(1, "Output format is required"),
  schema: JsonSchemaSchema.optional(),
  examples: z.record(z.string(), z.object({ value: z.unknown() })).optional(),
});

export const GeneratedFileSchema = z.object({
  path: z.string().min(1),
  required: z.boolean().optional(),
  media_type: z.string().optional(),
  encoding: z.string().optional(),
  schema: JsonSchemaSchema.optional(),
  description: z.string().optional(),
});

const exitCodeKey = z.string().regex(/^\d{1,3}$/, "Exit code must be 0-255");

export const ExitSchema = z.object({
  description: z.string().min(1, "Exit description is required"),
  stdout: OutputContractSchema.optional(),
  stderr: OutputContractSchema.optional(),
  files: z.array(GeneratedFileSchema).optional(),
});

export const FramingSchema = z.object({
  type: z.string(),
  delimiter: z.string().optional(),
});

export const StreamContractSchema = z.object({
  required: z.boolean().optional(),
  format: z.string().min(1, "Stream format is required"),
  encoding: z.string().optional(),
  framing: FramingSchema.optional(),
  schema: JsonSchemaSchema.optional(),
  item_schema: JsonSchemaSchema.optional(),
  flush: z.object({ policy: z.string() }).optional(),
});

export const StreamsSchema = z.object({
  stdin: StreamContractSchema.optional(),
  stdout: StreamContractSchema.optional(),
  stderr: StreamContractSchema.optional(),
});

export const SignalSchema = z.object({
  description: z.string(),
});

export const ExampleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  command: z.string().optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  expected_exit_code: z.number().int().optional(),
});

export const DeprecationInfoSchema = z.object({
  since: z.string().optional(),
  message: z.string().optional(),
  alternative: z.string().optional(),
});

// ─── x-agent Extension Schema ───────────────────────────────────

export const HumanReviewSchema = z.object({
  required: z.boolean(),
  reason: z.string().optional(),
});

export const RollbackSchema = z.object({
  supported: z.boolean(),
  notes: z.string().optional(),
});

export const XAgentSchema = z.object({
  risk_level: z.enum(["low", "medium", "high", "critical"]).optional(),
  requires_confirmation: z.boolean().optional(),
  idempotent: z.boolean().optional(),
  side_effects: z.array(z.string()).optional(),
  safe_dry_run_option: z.string().optional(),
  recommended_before_use: z.array(z.string()).optional(),
  execution_mode: z.string().optional(),
  reads: z.array(z.string()).optional(),
  writes: z.array(z.string()).optional(),
  requires_network: z.boolean().optional(),
  requires_secrets: z.array(z.string()).optional(),
  human_review: HumanReviewSchema.optional(),
  rollback: RollbackSchema.optional(),
  dsl_task: z.string().optional(),
  dsl_workflow: z.string().optional(),
}).passthrough().refine(
  (data) => !(data.dsl_task && data.dsl_workflow),
  { message: "dsl_task and dsl_workflow are mutually exclusive — specify one or the other" },
);

// ─── Command Schema ─────────────────────────────────────────────

export const CommandSchema = z
  .object({
    path: z.array(z.string()).optional(),
    summary: z.string().min(1, "Command summary is required"),
    description: z.string().optional(),
    usage: z.array(z.string()).optional(),
    arguments: z.array(ArgumentSchema).optional(),
    options: z.array(OptionSchema).optional(),
    effects: EffectsSchema.optional(),
    streams: StreamsSchema.optional(),
    signals: z.record(z.string(), SignalSchema).optional(),
    exits: z.record(exitCodeKey, ExitSchema),
    examples: z.array(ExampleSchema).optional(),
    deprecated: DeprecationInfoSchema.optional(),
  })
  .passthrough(); // allow x-* extensions

export const EnvVarSchema = z.object({
  description: z.string().optional(),
  schema: JsonSchemaSchema.optional(),
  required: z.boolean().optional(),
  sensitive: z.boolean().optional(),
});

export const CommandSetSchema = z
  .object({
    executable: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    commands: z.record(z.string(), CommandSchema),
    global_options: z.array(OptionSchema).optional(),
    env: z.record(z.string(), EnvVarSchema).optional(),
  })
  .passthrough(); // allow x-* extensions

export const InfoSchema = z.object({
  title: z.string().min(1, "info.title is required"),
  version: z.string().min(1, "info.version is required"),
  description: z.string().optional(),
  license: z.object({ name: z.string() }).optional(),
  contact: z
    .object({
      name: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
});

export const ComponentsSchema = z.object({
  schemas: z.record(z.string(), JsonSchemaSchema).optional(),
  examples: z.record(z.string(), z.unknown()).optional(),
  exits: z.record(z.string(), ExitSchema).optional(),
  stream_items: z.record(z.string(), z.unknown()).optional(),
  file_schemas: z.record(z.string(), z.unknown()).optional(),
});

export const CliContractsDocumentSchema = z.object({
  cli_contracts: z.string().min(1, "Spec version (cli_contracts) is required"),
  info: InfoSchema,
  artifact_slots: z.record(z.string(), ArtifactSlotSchema).optional(),
  command_sets: z
    .record(z.string(), CommandSetSchema)
    .refine((cs) => Object.keys(cs).length > 0, {
      message: "At least one command set is required",
    }),
  components: ComponentsSchema.optional(),
});

// ─── Config Schemas ─────────────────────────────────────────────

export const InputConfigSchema = z.object({
  files: z.array(z.string()).min(1),
});

export const ValidationConfigSchema = z.object({
  schema: z.string().optional(),
  strict: z.boolean().optional(),
  resolve_external_refs: z.boolean().optional(),
  allow_unknown_extensions: z.boolean().optional(),
});

export const ExecutionProfileCommandSetSchema = z.object({
  command: z.string(),
});

export const ExecutionProfileSchema = z.object({
  default: z.boolean().optional(),
  command_sets: z.record(z.string(), ExecutionProfileCommandSetSchema),
});

export const GeneratorConfigSchema = z.object({
  enabled: z.boolean(),
  output: z.string(),
  templates: z.string(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const ContractTestsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  profile: z.string().optional(),
  cases_dir: z.string().optional(),
  timeout_ms: z.number().int().positive().optional(),
  validate_stdout: z.boolean().optional(),
  validate_stderr: z.boolean().optional(),
  validate_files: z.boolean().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const DiffConfigSchema = z.object({
  breaking_change_policy: z.string().optional(),
  ignore: z.array(z.string()).optional(),
});

export const CliContractsConfigSchema = z.object({
  version: z.string(),
  input: InputConfigSchema.optional(),
  validation: ValidationConfigSchema.optional(),
  execution_profiles: z.record(z.string(), ExecutionProfileSchema).optional(),
  generators: z.record(z.string(), GeneratorConfigSchema).optional(),
  contract_tests: ContractTestsConfigSchema.optional(),
  diff: DiffConfigSchema.optional(),
});

// ─── Inferred Types ─────────────────────────────────────────────

export type CliContractsDocument = z.infer<typeof CliContractsDocumentSchema>;
export type Info = z.infer<typeof InfoSchema>;
export type CommandSet = z.infer<typeof CommandSetSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type Argument = z.infer<typeof ArgumentSchema>;
export type Option = z.infer<typeof OptionSchema>;
export type FileContract = z.infer<typeof FileContractSchema>;
export type CsvMetadata = z.infer<typeof CsvMetadataSchema>;
export type Exit = z.infer<typeof ExitSchema>;
export type OutputContract = z.infer<typeof OutputContractSchema>;
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;
export type Streams = z.infer<typeof StreamsSchema>;
export type StreamContract = z.infer<typeof StreamContractSchema>;
export type Framing = z.infer<typeof FramingSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type Example = z.infer<typeof ExampleSchema>;
export type DeprecationInfo = z.infer<typeof DeprecationInfoSchema>;
export type Components = z.infer<typeof ComponentsSchema>;
export type EnvVar = z.infer<typeof EnvVarSchema>;
export type XAgent = z.infer<typeof XAgentSchema>;
export type HumanReview = z.infer<typeof HumanReviewSchema>;
export type Rollback = z.infer<typeof RollbackSchema>;

export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
export type SlotDirection = z.infer<typeof SlotDirectionSchema>;
export type ArtifactSlot = z.infer<typeof ArtifactSlotSchema>;
export type EffectWrite = z.infer<typeof EffectWriteSchema>;
export type EffectRead = z.infer<typeof EffectReadSchema>;
export type NetworkEffect = z.infer<typeof NetworkEffectSchema>;
export type Effects = z.infer<typeof EffectsSchema>;

export type CliContractsConfig = z.infer<typeof CliContractsConfigSchema>;
export type InputConfig = z.infer<typeof InputConfigSchema>;
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type ExecutionProfile = z.infer<typeof ExecutionProfileSchema>;
export type ExecutionProfileCommandSet = z.infer<
  typeof ExecutionProfileCommandSetSchema
>;
export type GeneratorConfig = z.infer<typeof GeneratorConfigSchema>;
export type ContractTestsConfig = z.infer<typeof ContractTestsConfigSchema>;
export type DiffConfig = z.infer<typeof DiffConfigSchema>;
