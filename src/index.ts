import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export const VERSION: string = pkg.version;

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
  Components,
  JsonSchema,
  CliContractsConfig,
  NormalizedContext,
  NormalizedCommandSet,
  NormalizedCommand,
  NormalizedExit,
  Diagnostic,
  ValidateResult,
  GeneratorOutput,
  GenerateResult,
  DiffChange,
  DiffResult,
  XAgent,
  HumanReview,
  Rollback,
} from "./types.js";

export type {
  RiskLevel,
  ExecutionMode,
  EffectWrite,
  EffectRead,
  NetworkEffect,
  Effects,
} from "./schema.js";

export type {
  DerivedPolicy,
  DerivedReadEffect,
  DerivedWriteEffect,
  IntrospectionResult,
  PolicyDerivationInput,
  OptionInput,
} from "./policy.js";

export {
  CliContractsDocumentSchema,
  CliContractsConfigSchema,
  InfoSchema,
  CommandSetSchema,
  CommandSchema,
  ArgumentSchema,
  OptionSchema,
  ExitSchema,
  OutputContractSchema,
  FileContractSchema,
  StreamsSchema,
  StreamContractSchema,
  ComponentsSchema,
  XAgentSchema,
  HumanReviewSchema,
  RollbackSchema,
  RiskLevelSchema,
  ExecutionModeSchema,
  EffectWriteSchema,
  EffectReadSchema,
  NetworkEffectSchema,
  EffectsSchema,
} from "./schema.js";

export { parseContractFile, parseContractString } from "./parser.js";
export { validateContract } from "./validator.js";
export {
  validateXAgentDeprecation,
  validateEffectsConsistency,
} from "./validator.js";
export { resolveRefs, collectRefs, validateRefs } from "./ref-resolver.js";
export { normalizeContract } from "./normalizer.js";
export { generateMarkdown } from "./generators/markdown.js";
export { generateTypeScript } from "./generators/typescript.js";
export { derivePolicy, isOptionActive, buildIntrospection } from "./policy.js";
