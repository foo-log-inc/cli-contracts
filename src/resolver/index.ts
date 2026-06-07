export {
  MergeError,
  hasOperator,
  applyArrayMergeOperator,
  deepMergeEntities,
  mergeSection,
  mergeEntityMaps,
  mergeCliContract,
} from "./merger.js";
export type { SectionMode } from "./merger.js";
export {
  ResolveError,
  resolveContractRaw,
  resolveContractFile,
  resolveContractString,
} from "./resolve.js";
export type { ResolveResult } from "./resolve.js";
