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
  quoteChar: z.string().optional(),
  headerRows: z.number().int().optional(),
  footerRows: z.number().int().optional(),
});

export const FileContractSchema = z.object({
  mode: z.enum(["read", "write", "append", "readWrite"]),
  exists: z.boolean().optional(),
  mediaType: z.string().optional(),
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

export const OptionSchema = z.object({
  name: z.string().min(1, "Option name must not be empty"),
  aliases: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  valueName: z.string().optional(),
  description: z.string().optional(),
  schema: JsonSchemaSchema.optional(),
  file: FileContractSchema.optional(),
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
  mediaType: z.string().optional(),
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
  itemSchema: JsonSchemaSchema.optional(),
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
  expectedExitCode: z.number().int().optional(),
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
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  requiresConfirmation: z.boolean().optional(),
  idempotent: z.boolean().optional(),
  sideEffects: z.array(z.string()).optional(),
  safeDryRunOption: z.string().optional(),
  recommendedBeforeUse: z.array(z.string()).optional(),
  executionMode: z.string().optional(),
  reads: z.array(z.string()).optional(),
  writes: z.array(z.string()).optional(),
  requiresNetwork: z.boolean().optional(),
  requiresSecrets: z.array(z.string()).optional(),
  humanReview: HumanReviewSchema.optional(),
  rollback: RollbackSchema.optional(),
}).passthrough();

// ─── Command Schema ─────────────────────────────────────────────

export const CommandSchema = z
  .object({
    path: z.array(z.string()).optional(),
    summary: z.string().min(1, "Command summary is required"),
    description: z.string().optional(),
    usage: z.array(z.string()).optional(),
    arguments: z.array(ArgumentSchema).optional(),
    options: z.array(OptionSchema).optional(),
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
});

export const CommandSetSchema = z
  .object({
    executable: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    commands: z.record(z.string(), CommandSchema),
    globalOptions: z.array(OptionSchema).optional(),
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
  streamItems: z.record(z.string(), z.unknown()).optional(),
  fileSchemas: z.record(z.string(), z.unknown()).optional(),
});

export const CliContractsDocumentSchema = z.object({
  cliContracts: z.string().min(1, "Spec version (cliContracts) is required"),
  info: InfoSchema,
  commandSets: z
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
  resolveExternalRefs: z.boolean().optional(),
  allowUnknownExtensions: z.boolean().optional(),
});

export const ExecutionProfileCommandSetSchema = z.object({
  command: z.string(),
});

export const ExecutionProfileSchema = z.object({
  default: z.boolean().optional(),
  commandSets: z.record(z.string(), ExecutionProfileCommandSetSchema),
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
  casesDir: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  validateStdout: z.boolean().optional(),
  validateStderr: z.boolean().optional(),
  validateFiles: z.boolean().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const DiffConfigSchema = z.object({
  breakingChangePolicy: z.string().optional(),
  ignore: z.array(z.string()).optional(),
});

export const CliContractsConfigSchema = z.object({
  version: z.string(),
  input: InputConfigSchema.optional(),
  validation: ValidationConfigSchema.optional(),
  executionProfiles: z.record(z.string(), ExecutionProfileSchema).optional(),
  generators: z.record(z.string(), GeneratorConfigSchema).optional(),
  contractTests: ContractTestsConfigSchema.optional(),
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
