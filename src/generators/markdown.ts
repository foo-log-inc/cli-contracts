import type {
  NormalizedContext,
  NormalizedCommandSet,
  NormalizedCommand,
  NormalizedExit,
  Option,
  Argument,
  OutputContract,
  Streams,
  StreamContract,
  JsonSchema,
  GeneratedFile,
} from "../types.js";

export interface MarkdownGeneratorOptions {
  includeExamples?: boolean;
  includeSchemas?: boolean;
  includeExtensions?: boolean;
  includeToc?: boolean;
}

export function generateMarkdown(
  ctx: NormalizedContext,
  options: MarkdownGeneratorOptions = {},
): string {
  const {
    includeExamples = true,
    includeSchemas = true,
    includeExtensions = true,
    includeToc = true,
  } = options;

  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(`# ${ctx.info.title}`);
  push("");
  if (ctx.info.description) {
    push(ctx.info.description);
    push("");
  }
  push(`**Version:** ${ctx.info.version}`);
  push("");

  if (includeToc) {
    push("## Table of Contents");
    push("");
    for (const cs of ctx.commandSets) {
      push(`- [${cs.executable}](#${anchor(cs.executable)})`);
      for (const cmd of cs.commands) {
        push(`  - [${cmd.id}](#${anchor(cmd.fullId)})`);
      }
    }
    push("");
  }

  push("---");
  push("");

  for (const cs of ctx.commandSets) {
    renderCommandSet(cs, lines, {
      includeExamples,
      includeSchemas,
      includeExtensions,
    });
  }

  if (includeSchemas && ctx.components.schemas) {
    push("---");
    push("");
    push("## Schemas");
    push("");
    for (const [name, schema] of Object.entries(ctx.components.schemas)) {
      renderSchema(name, schema, lines);
    }
  }

  return lines.join("\n");
}

// ─── Command Set / Command rendering ────────────────────────────

function renderCommandSet(
  cs: NormalizedCommandSet,
  lines: string[],
  opts: MarkdownGeneratorOptions,
): void {
  lines.push(`## ${cs.executable}`);
  lines.push("");
  if (cs.summary) {
    lines.push(cs.summary);
    lines.push("");
  }
  if (cs.description) {
    lines.push(cs.description);
    lines.push("");
  }

  if (cs.globalOptions.length > 0) {
    lines.push("### Global Options");
    lines.push("");
    renderOptionsTable(cs.globalOptions, lines);
    lines.push("");
  }

  if (Object.keys(cs.env).length > 0) {
    lines.push("### Environment Variables");
    lines.push("");
    lines.push("| Variable | Description |");
    lines.push("|---|---|");
    for (const [name, envVar] of Object.entries(cs.env)) {
      lines.push(`| \`${name}\` | ${envVar.description ?? ""} |`);
    }
    lines.push("");
  }

  for (const cmd of cs.commands) {
    renderCommand(cmd, cs, lines, opts);
  }
}

function renderCommand(
  cmd: NormalizedCommand,
  cs: NormalizedCommandSet,
  lines: string[],
  opts: MarkdownGeneratorOptions,
): void {
  lines.push(`### ${cmd.id}`);
  lines.push("");
  lines.push(cmd.summary);
  lines.push("");

  if (cmd.description) {
    lines.push(cmd.description);
    lines.push("");
  }

  if (cmd.deprecated) {
    lines.push(
      `> **Deprecated**${cmd.deprecated.message ? `: ${cmd.deprecated.message}` : ""}`,
    );
    if (cmd.deprecated.alternative) {
      lines.push(`> Use \`${cmd.deprecated.alternative}\` instead.`);
    }
    lines.push("");
  }

  if (cmd.usage && cmd.usage.length > 0) {
    lines.push("**Usage:**");
    lines.push("");
    for (const u of cmd.usage) {
      lines.push("```");
      lines.push(u);
      lines.push("```");
    }
    lines.push("");
  } else {
    lines.push("**Usage:**");
    lines.push("");
    lines.push("```");
    lines.push(buildUsageLine(cmd));
    lines.push("```");
    lines.push("");
  }

  if (cmd.arguments.length > 0) {
    lines.push("#### Arguments");
    lines.push("");
    renderArgumentsTable(cmd.arguments, lines);
    lines.push("");
  }

  if (cmd.options.length > 0) {
    lines.push("#### Options");
    lines.push("");
    renderOptionsTable(cmd.options, lines);
    lines.push("");
  }

  if (cmd.streams) {
    renderStreams(cmd.streams, lines);
  }

  if (cmd.signals && Object.keys(cmd.signals).length > 0) {
    lines.push("#### Signals");
    lines.push("");
    lines.push("| Signal | Description |");
    lines.push("|---|---|");
    for (const [sig, info] of Object.entries(cmd.signals)) {
      lines.push(`| \`${sig}\` | ${info.description} |`);
    }
    lines.push("");
  }

  if (cmd.exits.length > 0) {
    lines.push("#### Exit Codes");
    lines.push("");
    for (const exit of cmd.exits) {
      renderExit(exit, lines, opts);
    }
  }

  if (opts.includeExtensions && Object.keys(cmd.extensions).length > 0) {
    renderExtensions(cmd.extensions, lines);
  }

  lines.push("---");
  lines.push("");
}

// ─── Arguments / Options tables ─────────────────────────────────

function renderArgumentsTable(args: Argument[], lines: string[]): void {
  lines.push("| Name | Required | Description |");
  lines.push("|---|---|---|");
  for (const arg of args) {
    const req = arg.required ? "Yes" : "No";
    const desc = arg.description ?? "";
    const variadicTag = arg.variadic ? " *(variadic)*" : "";
    lines.push(`| \`${arg.name}\`${variadicTag} | ${req} | ${desc} |`);
  }
}

function renderOptionsTable(opts: Option[], lines: string[]): void {
  lines.push("| Option | Aliases | Required | Default | Description |");
  lines.push("|---|---|---|---|---|");
  for (const opt of opts) {
    const aliases = opt.aliases
      ? opt.aliases.map((a) => `-${a}`).join(", ")
      : "";
    const req = opt.required ? "Yes" : "No";
    const def = opt.schema?.default !== undefined
      ? `\`${JSON.stringify(opt.schema.default)}\``
      : "";
    const desc = opt.description ?? "";
    lines.push(`| \`--${opt.name}\` | ${aliases} | ${req} | ${def} | ${desc} |`);
  }
}

// ─── Streams ────────────────────────────────────────────────────

function renderStreams(streams: Streams, lines: string[]): void {
  lines.push("#### Streams");
  lines.push("");
  for (const [key, stream] of Object.entries(streams)) {
    if (!stream) continue;
    renderStream(key, stream, lines);
  }
}

function renderStream(
  name: string,
  stream: StreamContract,
  lines: string[],
): void {
  lines.push(`**${name}:**`);
  lines.push("");
  const parts: string[] = [];
  parts.push(`- Format: \`${stream.format}\``);
  if (stream.encoding) parts.push(`- Encoding: \`${stream.encoding}\``);
  if (stream.required !== undefined)
    parts.push(`- Required: ${stream.required ? "Yes" : "No"}`);
  if (stream.framing) {
    parts.push(`- Framing: \`${stream.framing.type}\``);
    if (stream.framing.delimiter)
      parts.push(`- Delimiter: \`${stream.framing.delimiter}\``);
  }
  if (stream.flush) parts.push(`- Flush: \`${stream.flush.policy}\``);
  lines.push(...parts);
  lines.push("");
}

// ─── Exit codes ─────────────────────────────────────────────────

function renderExit(
  exit: NormalizedExit,
  lines: string[],
  opts: MarkdownGeneratorOptions,
): void {
  lines.push(`**Exit ${exit.exitCode}:** ${exit.description}`);
  lines.push("");

  if (exit.stdout) {
    renderOutputContract("stdout", exit.stdout, lines, opts);
  }
  if (exit.stderr) {
    renderOutputContract("stderr", exit.stderr, lines, opts);
  }
  if (exit.files && exit.files.length > 0) {
    renderGeneratedFiles(exit.files, lines);
  }
}

function renderOutputContract(
  label: string,
  output: OutputContract,
  lines: string[],
  opts: MarkdownGeneratorOptions,
): void {
  const reqNote = output.required === false ? " *(optional)*" : "";
  lines.push(`- **${label}:** format=\`${output.format}\`${reqNote}`);

  if (opts.includeSchemas && output.schema) {
    const ref = output.schema.$ref;
    if (ref) {
      const typeName = ref.split("/").pop() ?? ref;
      lines.push(`  - Schema: [\`${typeName}\`](#${anchor(typeName)})`);
    } else {
      lines.push("");
      renderSchemaTable(output.schema, lines, "  ");
      renderSchemaDetails(output.schema, lines, "  ");
    }
  }
  lines.push("");
}

function renderGeneratedFiles(files: GeneratedFile[], lines: string[]): void {
  lines.push("- **Generated files:**");
  for (const f of files) {
    const parts = [`  - \`${f.path}\``];
    if (f.mediaType) parts.push(`(${f.mediaType})`);
    if (f.required === false) parts.push("*(optional)*");
    lines.push(parts.join(" "));
  }
  lines.push("");
}

// ─── Extensions ─────────────────────────────────────────────────

function renderExtensions(
  ext: Record<string, unknown>,
  lines: string[],
): void {
  lines.push("#### Extensions");
  lines.push("");
  lines.push("```yaml");
  lines.push(yamlLike(ext));
  lines.push("```");
  lines.push("");
}

// ─── Schema rendering (table + details) ─────────────────────────

function renderSchema(
  name: string,
  schema: JsonSchema,
  lines: string[],
): void {
  lines.push(`### ${name}`);
  lines.push("");
  if (schema.description) {
    lines.push(schema.description);
    lines.push("");
  }
  if (schema.type) {
    lines.push(`Type: \`${schema.type}\``);
    lines.push("");
  }

  if (schema.enum) {
    lines.push(`Values: ${schema.enum.map((v) => `\`${v}\``).join(", ")}`);
    lines.push("");
  }

  if (schema.properties || (schema.type === "array" && schema.items)) {
    renderSchemaTable(schema, lines, "");
    renderSchemaDetails(schema, lines, "");
  }

  lines.push("");
}

/**
 * Renders a schema as a flat property table. Nested objects are
 * flattened using dot notation (e.g. `errors[].path`).
 */
function renderSchemaTable(
  schema: JsonSchema,
  lines: string[],
  indent: string,
): void {
  const rows = flattenSchemaRows(schema, "");
  if (rows.length === 0) return;

  lines.push(`${indent}| Property | Type | Required | Description |`);
  lines.push(`${indent}|---|---|---|---|`);
  for (const row of rows) {
    lines.push(
      `${indent}| \`${row.path}\` | \`${row.type}\` | ${row.required ? "Yes" : "No"} | ${row.description} |`,
    );
  }
}

interface SchemaRow {
  path: string;
  type: string;
  required: boolean;
  description: string;
}

function flattenSchemaRows(
  schema: JsonSchema,
  prefix: string,
  parentRequired?: Set<string>,
): SchemaRow[] {
  const rows: SchemaRow[] = [];

  if (schema.type === "object" && schema.properties) {
    const requiredSet = new Set(schema.required ?? []);
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      const path = prefix ? `${prefix}.${prop}` : prop;
      const isRequired = parentRequired
        ? parentRequired.has(prop)
        : requiredSet.has(prop);

      if (isNestedObject(propSchema)) {
        rows.push({
          path,
          type: "object",
          required: isRequired,
          description: propSchema.description ?? "",
        });
        rows.push(
          ...flattenSchemaRows(propSchema, path, new Set(propSchema.required ?? [])),
        );
      } else if (isArrayOfObjects(propSchema)) {
        const itemSchema = propSchema.items!;
        const itemType = itemSchema.$ref
          ? `${refToName(itemSchema.$ref)}[]`
          : "object[]";
        rows.push({
          path,
          type: itemType,
          required: isRequired,
          description: propSchema.description ?? "",
        });
        if (!itemSchema.$ref) {
          rows.push(
            ...flattenSchemaRows(
              itemSchema,
              `${path}[]`,
              new Set(itemSchema.required ?? []),
            ),
          );
        }
      } else {
        rows.push({
          path,
          type: describeType(propSchema),
          required: isRequired,
          description: propSchema.description ?? "",
        });
      }
    }
  } else if (schema.type === "array" && schema.items) {
    const itemSchema = schema.items;
    if (itemSchema.properties) {
      rows.push(
        ...flattenSchemaRows(
          itemSchema,
          prefix ? `${prefix}[]` : "[]",
          new Set(itemSchema.required ?? []),
        ),
      );
    }
  }

  return rows;
}

function isNestedObject(schema: JsonSchema): boolean {
  return schema.type === "object" && !!schema.properties && !schema.$ref;
}

function isArrayOfObjects(schema: JsonSchema): boolean {
  if (schema.type !== "array" || !schema.items) return false;
  const items = schema.items;
  return (items.type === "object" && !!items.properties) || !!items.$ref;
}

function describeType(schema: JsonSchema): string {
  if (schema.$ref) return refToName(schema.$ref);

  if (schema.enum) {
    const vals = schema.enum.map((v) =>
      typeof v === "string" ? `"${v}"` : String(v),
    );
    return vals.length <= 5 ? vals.join(" \\| ") : `enum(${vals.length} values)`;
  }

  if (schema.type === "array") {
    if (schema.items) {
      return `${describeType(schema.items)}[]`;
    }
    return "array";
  }

  if (schema.type === "object") {
    if (schema.additionalProperties) return "Record<string, any>";
    return "object";
  }

  const base = String(schema.type ?? "any");

  const constraints: string[] = [];
  if (schema.format) constraints.push(`format: ${schema.format}`);
  if (schema.minimum !== undefined) constraints.push(`min: ${schema.minimum}`);
  if (schema.maximum !== undefined) constraints.push(`max: ${schema.maximum}`);

  return constraints.length > 0
    ? `${base} (${constraints.join(", ")})`
    : base;
}

/**
 * Renders the full JSON Schema inside a <details> block.
 */
function renderSchemaDetails(
  schema: JsonSchema,
  lines: string[],
  indent: string,
): void {
  lines.push("");
  lines.push(`${indent}<details>`);
  lines.push(`${indent}<summary>JSON Schema</summary>`);
  lines.push("");
  lines.push(`${indent}\`\`\`json`);
  const jsonStr = JSON.stringify(schema, null, 2);
  for (const line of jsonStr.split("\n")) {
    lines.push(`${indent}${line}`);
  }
  lines.push(`${indent}\`\`\``);
  lines.push("");
  lines.push(`${indent}</details>`);
}

// ─── Utilities ──────────────────────────────────────────────────

function refToName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

function buildUsageLine(cmd: NormalizedCommand): string {
  const parts = [cmd.invocation];
  for (const arg of cmd.arguments) {
    if (arg.required) {
      parts.push(`<${arg.name}>`);
    } else {
      parts.push(`[${arg.name}]`);
    }
  }
  for (const opt of cmd.options) {
    if (opt.required) {
      parts.push(`--${opt.name}`);
    } else {
      parts.push(`[--${opt.name}]`);
    }
  }
  return parts.join(" ");
}

function anchor(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function yamlLike(obj: unknown, indent = 0): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) {
    return obj
      .map((item) => `${" ".repeat(indent)}- ${yamlLike(item, indent + 2)}`)
      .join("\n");
  }
  if (typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>)
      .map(
        ([k, v]) =>
          `${" ".repeat(indent)}${k}: ${
            typeof v === "object" && v !== null
              ? "\n" + yamlLike(v, indent + 2)
              : yamlLike(v, indent)
          }`,
      )
      .join("\n");
  }
  return String(obj);
}
