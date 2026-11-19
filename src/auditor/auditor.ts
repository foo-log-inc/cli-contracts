/**
 * Audit orchestrator — runs LLM-based semantic audits via agent-contracts-runtime.
 *
 * Uses executeTask() from agent-contracts-runtime for the complete execution
 * lifecycle: adapter creation, DSL context loading, progress sink, and task invocation.
 *
 * agent-contracts-runtime is an optional peer dependency — it is loaded
 * dynamically at audit invocation time so that users who don't use audit
 * have zero additional overhead.
 */

import type { AuditConfig, AuditOptions, AuditRunResult } from "./types.js";
import { resolvedDsl } from "../generated/dsl/index.js";

const EXIT_RUNTIME_MISSING = 11;
const EXIT_ADAPTER_ERROR = 12;

export { EXIT_RUNTIME_MISSING, EXIT_ADAPTER_ERROR };

export async function runAudit(
  userRequest: string,
  taskId: string,
  auditConfig: AuditConfig,
  options: AuditOptions,
): Promise<AuditRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let executeTask: (taskId: string, options: any) => Promise<any>;
  try {
    const runtime = await import("agent-contracts-runtime");
    executeTask = runtime.executeTask;
  } catch {
    throw Object.assign(
      new Error(
        "agent-contracts-runtime is not installed. " +
        "Install it to use this command, or use --show-prompt to inspect the prompt.\n" +
        "  npm install agent-contracts-runtime",
      ),
      { exitCode: EXIT_RUNTIME_MISSING },
    );
  }

  const adapterName = auditConfig.adapter ?? "mock";

  let result;
  try {
    result = await executeTask(taskId, {
      request: userRequest,
      adapter: adapterName,
      model: auditConfig.model,
      dsl: resolvedDsl,
      logFile: options.logFile,
      maxFollowUps: 3,
      maxRetries: 1,
      adapterOptions: {
        tools: ["Read", "Glob", "Grep"],
        permissionMode: "bypassPermissions",
      },
    });
  } catch (err) {
    throw Object.assign(err as Error, { exitCode: EXIT_ADAPTER_ERROR });
  }

  // A task that did not complete has no result to report: it ends as the
  // adapter error the contract declares, not as a run without findings.
  const outcome = result.outcome;
  if (outcome.status !== "success") {
    const reason =
      outcome.status === "error" ? outcome.message :
      outcome.status === "escalation" ? outcome.reason :
      outcome.status === "validation_error" ? outcome.errors?.message :
      undefined;
    throw Object.assign(
      new Error(`The ${taskId} task ended with ${outcome.status}${reason ? `: ${reason}` : ""}`),
      { exitCode: EXIT_ADAPTER_ERROR },
    );
  }
  return {
    taskId,
    data: outcome.data,
    raw: (outcome.raw as string) ?? "",
    prompt: userRequest,
    followUpsUsed: result.follow_ups_used,
    retriesUsed: result.retries_used,
  };
}
