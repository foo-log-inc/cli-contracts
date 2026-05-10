/**
 * AI Agent Interoperability Reference — subpath export.
 *
 * Re-exports the reference schemas (XAgentSchema, etc.) and types
 * for AI-agent diagnostic output (AgentAuditResult, AgentFinding, etc.)
 * that other toolchains can adopt as common conventions.
 */

export { XAgentSchema, HumanReviewSchema, RollbackSchema } from "./schema.js";
export type { XAgent, HumanReview, Rollback } from "./schema.js";

export { validateXAgent } from "./validator.js";

export type {
  AgentEvidence,
  AgentFinding,
  AgentRecommendedAction,
  AgentAuditResult,
} from "./generated/types.js";
