import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import type { NormalizedContext } from "../types.js";

export interface GeneratorManifest {
  name: string;
  description?: string;
  entrypoints: ManifestEntrypoint[];
}

export interface ManifestEntrypoint {
  template: string;
  output: string;
  each?: string;
}

export interface HandlebarsRenderResult {
  outputPath: string;
  content: string;
}

export async function loadGeneratorManifest(
  manifestPath: string,
): Promise<GeneratorManifest> {
  const content = await readFile(manifestPath, "utf-8");
  return parseYaml(content) as GeneratorManifest;
}

export async function renderCustomTemplates(
  templateDir: string,
  manifest: GeneratorManifest,
  ctx: NormalizedContext,
  outputBase: string,
  generatorOptions: Record<string, unknown> = {},
): Promise<HandlebarsRenderResult[]> {
  const hbs = Handlebars.create();
  registerHelpers(hbs);

  const results: HandlebarsRenderResult[] = [];

  for (const entry of manifest.entrypoints) {
    const templatePath = resolve(templateDir, entry.template);
    const templateContent = await readFile(templatePath, "utf-8");
    const compiled = hbs.compile(templateContent);

    if (entry.each) {
      const items = getIterableFromContext(ctx, entry.each);
      for (const item of items) {
        const data = {
          ...ctx,
          [singularize(entry.each)]: item,
          options: generatorOptions,
        };
        const content = compiled(data);
        const outputPath = resolve(
          outputBase,
          hbs.compile(entry.output)(data),
        );
        results.push({ outputPath, content });
      }
    } else {
      const data = { ...ctx, options: generatorOptions };
      const content = compiled(data);
      const outputPath = resolve(
        outputBase,
        hbs.compile(entry.output)(data),
      );
      results.push({ outputPath, content });
    }
  }

  return results;
}

function registerHelpers(hbs: typeof Handlebars): void {
  hbs.registerHelper("eq", (a, b) => a === b);
  hbs.registerHelper("ne", (a, b) => a !== b);
  hbs.registerHelper("json", (obj) => JSON.stringify(obj, null, 2));

  hbs.registerHelper("pascalCase", (str: string) =>
    str
      .split(/[.\-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(""),
  );

  hbs.registerHelper("camelCase", (str: string) => {
    const pascal = str
      .split(/[.\-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  });

  hbs.registerHelper("snakeCase", (str: string) =>
    str.replace(/[.\-]/g, "_").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase(),
  );

  hbs.registerHelper("upper", (str: string) => str.toUpperCase());
  hbs.registerHelper("lower", (str: string) => str.toLowerCase());

  hbs.registerHelper("join", (arr: unknown[], sep: string) => {
    if (!Array.isArray(arr)) return "";
    return arr.join(typeof sep === "string" ? sep : ", ");
  });
}

function getIterableFromContext(
  ctx: NormalizedContext,
  key: string,
): unknown[] {
  switch (key) {
    case "commandSets":
      return ctx.commandSets;
    default:
      return [];
  }
}

function singularize(str: string): string {
  if (str.endsWith("Sets")) return str.slice(0, -1);
  if (str.endsWith("s")) return str.slice(0, -1);
  return str;
}
