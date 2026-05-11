export interface AuditConfig {
  adapter?: string;
  model?: string;
  temperature?: number;
}

export interface AuditOptions {
  taskId: string;
  format: "json" | "text";
  showPrompt: boolean;
  failOn: "warning" | "error" | "critical";
  outputFile?: string;
}

export interface AuditRunResult {
  taskId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any | null;
  raw: string;
  prompt: string;
  showPrompt: boolean;
  status: "success" | "validation_error" | "escalation" | "error";
  errorMessage?: string;
  followUpsUsed: number;
  retriesUsed: number;
}
