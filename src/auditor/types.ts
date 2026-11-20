export interface AuditConfig {
  adapter?: string;
  model?: string;
  temperature?: number;
}

export interface AuditOptions {
  taskId: string;
  format: "json" | "text";
  failOn: "warning" | "error" | "critical";
  outputFile?: string;
  logFile?: string;
}

export interface AuditRunResult {
  taskId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  raw: string;
  prompt: string;
  followUpsUsed: number;
  retriesUsed: number;
}
