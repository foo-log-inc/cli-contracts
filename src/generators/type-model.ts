import type { Components, JsonSchema, NormalizedCommand, NormalizedContext, Option } from "../types.js";
import { optionFlags, optionTakesManyValues } from "../option-flags.js";
import { toCamelCase, toPascalCase } from "./typescript.js";

// The types a contract declares, once, for every language: a JSON Schema as a
// type expression (`schemaType`), and for the languages without structural
// types, the declarations they render (`buildTypeModel`): every object type
// named (an object written inside another type is given a name) and every
// allOf merged into one record.

export type TypeExpr =
  | { kind: "unknown" }
  | { kind: "string" }
  | { kind: "integer" }
  | { kind: "number" }
  | { kind: "boolean" }
  /** A component, by its name. */
  | { kind: "ref"; name: string }
  /** An enum: one of the values. */
  | { kind: "literals"; values: unknown[] }
  /** oneOf or anyOf. */
  | { kind: "union"; members: TypeExpr[] }
  /** allOf. */
  | { kind: "intersection"; members: TypeExpr[] }
  | { kind: "array"; items: TypeExpr }
  | { kind: "object"; fields: Field[] }
  /** An object of any keys. */
  | { kind: "map" };

export interface Field {
  name: string;
  optional: boolean;
  type: TypeExpr;
}

function refName(ref: string): string {
  const parts = ref.split("/");
  return parts[parts.length - 1]!;
}

/** A JSON Schema as a type expression. */
export function schemaType(schema?: JsonSchema): TypeExpr {
  if (!schema) return { kind: "unknown" };
  if (schema.$ref) return { kind: "ref", name: refName(schema.$ref) };
  if (schema.oneOf) return { kind: "union", members: schema.oneOf.map(schemaType) };
  if (schema.anyOf) return { kind: "union", members: schema.anyOf.map(schemaType) };
  if (schema.allOf) return { kind: "intersection", members: schema.allOf.map(schemaType) };
  if (schema.enum) return { kind: "literals", values: schema.enum };
  switch (schema.type) {
    case "string":
      return { kind: "string" };
    case "integer":
      return { kind: "integer" };
    case "number":
      return { kind: "number" };
    case "boolean":
      return { kind: "boolean" };
    case "array":
      return { kind: "array", items: schemaType(schema.items) };
    case "object":
      if (schema.properties) {
        const required = new Set(schema.required ?? []);
        return {
          kind: "object",
          fields: Object.entries(schema.properties).map(([name, s]) => ({
            name,
            optional: !required.has(name),
            type: schemaType(s),
          })),
        };
      }
      return { kind: "map" };
    default:
      return { kind: "unknown" };
  }
}

// ─── Declarations for the languages without structural types ────────

/** A record (struct, TypedDict, array shape); its fields include those of every allOf member. */
export interface RecordDecl {
  kind: "record";
  name: string;
  fields: Field[];
}

/** An enum of strings. */
export interface EnumDecl {
  kind: "enum";
  name: string;
  values: string[];
}

export interface AliasDecl {
  kind: "alias";
  name: string;
  type: TypeExpr;
}

export type Decl = RecordDecl | EnumDecl | AliasDecl;

export interface CommandTypes {
  id: string;
  fullId: string;
  /** The PascalCase name the command's types start with. */
  name: string;
  path: string[];
  /** The client's arguments, in order. */
  arguments: Array<Field & { variadic: boolean }>;
  /** The client's options: the field (keyed as the program keys it) and how it is given. */
  options: Array<
    Field & {
      long: string;
      /** For a boolean whose default is true: `--no-<name>`. */
      negated?: string;
      boolean: boolean;
      repeatable: boolean;
    }
  >;
  exitCodes: number[];
  exits: Array<{
    code: number;
    stdout?: { optional: boolean; type: TypeExpr };
    stderr?: { optional: boolean; type: TypeExpr };
  }>;
}

export interface TypeModel {
  decls: Decl[];
  commands: CommandTypes[];
  /** The components' JSON Schemas, by name, for the schema constants. */
  schemas: Array<[string, JsonSchema]>;
}

class Namer {
  private readonly used = new Set<string>();

  constructor(reserved: Iterable<string>) {
    for (const name of reserved) this.used.add(name);
  }

  /** A name not used yet: `base`, else `base2`, `base3`... */
  take(base: string): string {
    let name = base;
    for (let i = 2; this.used.has(name); i++) name = `${base}${i}`;
    this.used.add(name);
    return name;
  }
}

function sameType(a: TypeExpr, b: TypeExpr): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Merges fields of one record: a field in several is required if any requires it, and of every type. */
function mergeFields(groups: Field[][]): Field[] {
  const merged = new Map<string, { optional: boolean; types: TypeExpr[] }>();
  for (const fields of groups) {
    for (const f of fields) {
      const m = merged.get(f.name);
      if (!m) {
        merged.set(f.name, { optional: f.optional, types: [f.type] });
        continue;
      }
      m.optional = m.optional && f.optional;
      if (!m.types.some((t) => sameType(t, f.type))) m.types.push(f.type);
    }
  }
  return [...merged].map(([name, m]) => ({
    name,
    optional: m.optional,
    type: m.types.length === 1 ? m.types[0]! : { kind: "intersection", members: m.types },
  }));
}

/**
 * The declarations of a contract's types for the languages without
 * structural types, and the types of its commands.
 */
export function buildTypeModel(ctx: NormalizedContext): TypeModel {
  const components: Components["schemas"] = ctx.components.schemas ?? {};
  const componentNames = Object.keys(components);
  const commandNames = ctx.command_sets.flatMap((cs) => cs.commands.map((c) => toPascalCase(c.id)));
  const namer = new Namer([...componentNames, ...commandNames]);
  const decls: Decl[] = [];
  const declared = new Map<string, Decl>();
  const pending = new Set<string>();

  // A component's record fields, its allOf merged.
  const recordFields = (name: string, seen: Set<string>): Field[] => {
    const schema = components[name];
    if (!schema) throw new Error(`allOf refers to ${JSON.stringify(name)}, which is not a component schema`);
    if (seen.has(name)) throw new Error(`allOf of ${JSON.stringify(name)} refers to itself`);
    const type = schemaType(schema);
    if (type.kind === "object") return type.fields;
    if (type.kind === "intersection") return flatten(type.members, name, new Set([...seen, name]));
    throw new Error(`allOf refers to ${JSON.stringify(name)}, which is not an object with properties`);
  };

  const flatten = (members: TypeExpr[], owner: string, seen: Set<string>): Field[] =>
    mergeFields(
      members.map((m) => {
        if (m.kind === "ref") return recordFields(m.name, seen);
        if (m.kind === "object") return m.fields;
        throw new Error(
          `Cannot generate the types of ${JSON.stringify(owner)}: an allOf member is neither a $ref nor an object with properties`,
        );
      }),
    );

  // A type with every object in it named: an inline object (or allOf) becomes a record.
  const name = (type: TypeExpr, owner: string): TypeExpr => {
    switch (type.kind) {
      case "object": {
        const decl: RecordDecl = { kind: "record", name: namer.take(owner), fields: [] };
        decls.push(decl);
        decl.fields = type.fields.map((f) => ({ ...f, type: name(f.type, `${decl.name}${toPascalCase(f.name)}`) }));
        return { kind: "ref", name: decl.name };
      }
      case "intersection": {
        const decl: RecordDecl = { kind: "record", name: namer.take(owner), fields: [] };
        decls.push(decl);
        decl.fields = flatten(type.members, owner, new Set()).map((f) => ({
          ...f,
          type: name(f.type, `${decl.name}${toPascalCase(f.name)}`),
        }));
        return { kind: "ref", name: decl.name };
      }
      case "array":
        return { kind: "array", items: name(type.items, `${owner}Item`) };
      case "union":
        return { kind: "union", members: type.members.map((m, i) => name(m, `${owner}${i + 1}`)) };
      default:
        return type;
    }
  };

  // The components, in declaration order, before the types they contain.
  for (const [componentName, schema] of Object.entries(components)) {
    if (declared.has(componentName) || pending.has(componentName)) continue;
    pending.add(componentName);
    const type = schemaType(schema);
    let decl: Decl;
    if (type.kind === "object" || type.kind === "intersection") {
      const record: RecordDecl = { kind: "record", name: componentName, fields: [] };
      decls.push(record);
      const fields = type.kind === "object" ? type.fields : flatten(type.members, componentName, new Set([componentName]));
      record.fields = fields.map((f) => ({ ...f, type: name(f.type, `${componentName}${toPascalCase(f.name)}`) }));
      decl = record;
    } else if (type.kind === "literals" && type.values.length > 0 && type.values.every((v) => typeof v === "string")) {
      decl = { kind: "enum", name: componentName, values: type.values as string[] };
      decls.push(decl);
    } else {
      const alias: AliasDecl = { kind: "alias", name: componentName, type: { kind: "unknown" } };
      decls.push(alias);
      alias.type = name(type, `${componentName}Item`);
      decl = alias;
    }
    declared.set(componentName, decl);
  }

  const commands: CommandTypes[] = ctx.command_sets.flatMap((cs) =>
    cs.commands.map((cmd) => commandTypes(cmd, name)),
  );

  return { decls, commands, schemas: Object.entries(components) };
}

function optionField(opt: Option): TypeExpr {
  const type = schemaType(opt.schema);
  // A repeatable option is given once for each of its values.
  return optionTakesManyValues(opt) ? { kind: "array", items: type } : type;
}

function commandTypes(cmd: NormalizedCommand, name: (type: TypeExpr, owner: string) => TypeExpr): CommandTypes {
  const prefix = toPascalCase(cmd.id);
  return {
    id: cmd.id,
    fullId: cmd.full_id,
    name: prefix,
    path: cmd.path,
    arguments: cmd.arguments.map((arg) => ({
      name: toCamelCase(arg.name),
      optional: !arg.required,
      variadic: arg.variadic === true,
      type: arg.variadic
        ? { kind: "array", items: { kind: "string" } }
        : name(schemaType(arg.schema), `${prefix}Arg${toPascalCase(arg.name)}`),
    })),
    options: cmd.options.map((opt) => {
      const flags = optionFlags(opt);
      return {
        name: flags.key,
        optional: !opt.required,
        type: name(optionField(opt), `${prefix}Option${toPascalCase(opt.name)}`),
        long: flags.long,
        ...(flags.negated !== undefined ? { negated: flags.negated } : {}),
        boolean: opt.schema?.type === "boolean",
        repeatable: optionTakesManyValues(opt),
      };
    }),
    exitCodes: cmd.exits.map((e) => e.exit_code),
    exits: cmd.exits.map((exit) => ({
      code: exit.exit_code,
      ...(exit.stdout
        ? { stdout: { optional: exit.stdout.required === false, type: name(schemaType(exit.stdout.schema), `${prefix}Exit${exit.exit_code}Stdout`) } }
        : {}),
      ...(exit.stderr
        ? { stderr: { optional: exit.stderr.required === false, type: name(schemaType(exit.stderr.schema), `${prefix}Exit${exit.exit_code}Stderr`) } }
        : {}),
    })),
  };
}
