import { stringify as yamlStringify } from "yaml";

export type OutputFormat = "yaml" | "json";

export function formatOutput(data: unknown, format: OutputFormat): string {
  if (format === "yaml") {
    return yamlStringify(data, { lineWidth: 120 });
  }
  return JSON.stringify(data, null, 2) + "\n";
}

export function resolveFormat(raw: unknown): OutputFormat {
  if (raw === "json") return "json";
  return "yaml";
}
