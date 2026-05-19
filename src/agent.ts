/**
 * AI Agent Interoperability Reference — subpath export.
 *
 * Re-exports the reference schemas (XAgentSchema, etc.) and types
 * for AI-agent diagnostic output (AgentAuditResult, AgentFinding, etc.)
 * that other toolchains can adopt as common conventions.
 *
 * The canonical schema definitions live in the agent-contracts package
 * (dsl_base/components.yaml). These TypeScript types are derived from
 * the Zod schemas generated from that DSL.
 */

export { XAgentSchema, HumanReviewSchema, RollbackSchema } from "./schema.js";
export type { XAgent, HumanReview, Rollback } from "./schema.js";

export { validateXAgent } from "./validator.js";

export {
  CliAuditResultSchema as AgentAuditResultSchema,
} from "./generated/dsl/handoffs.js";
export type {
  CliAuditResult as AgentAuditResult,
} from "./generated/dsl/handoffs.js";

export type AgentEvidence = {
  kind: "file" | "command" | "schema" | "diff" | "stdout" | "stderr" | "text";
  target?: string;
  location?: string;
  excerpt?: string;
};

export type AgentFinding = {
  id?: string;
  severity: "info" | "warning" | "error" | "critical";
  category: string;
  target?: string;
  location?: string;
  message: string;
  recommendation?: string;
  confidence?: number;
  evidence?: AgentEvidence[];
  details?: Record<string, unknown>;
};

export type AgentRecommendedAction = {
  kind: "run_command" | "edit_file" | "review" | "confirm" | "block" | "ignore";
  title: string;
  command?: string;
  target?: string;
  rationale?: string;
};

export type TargetUri = {
  kind: string;
  id: string;
};

/**
 * Parse a target URI string into its kind and id components.
 * Supports formats like "artifact:api-contracts", "file:src/index.ts", "tool:linter".
 * Returns undefined if the target is not in URI format.
 */
export function parseTargetUri(target: string): TargetUri | undefined {
  const colonIdx = target.indexOf(":");
  if (colonIdx <= 0) return undefined;
  return {
    kind: target.slice(0, colonIdx),
    id: target.slice(colonIdx + 1),
  };
}
