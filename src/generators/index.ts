import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type {
  NormalizedContext,
  GeneratorConfig,
  GeneratorOutput,
  GenerateResult,
} from "../types.js";
import { generateMarkdown } from "./markdown.js";
import { generateTypeScript } from "./typescript.js";
import { generateGo } from "./go.js";
import { generateRust } from "./rust.js";
import { generatePython } from "./python.js";
import { generatePhp } from "./php.js";
import {
  loadGeneratorManifest,
  renderCustomTemplates,
} from "./handlebars-engine.js";

export async function runGenerators(
  ctx: NormalizedContext,
  generators: Record<string, GeneratorConfig>,
  filterNames?: string[],
  overrideOutput?: string,
  dryRun = false,
  clean = false,
  contractYaml?: string,
): Promise<GenerateResult> {
  const results: GeneratorOutput[] = [];

  for (const [name, config] of Object.entries(generators)) {
    if (filterNames && filterNames.length > 0 && !filterNames.includes(name)) {
      continue;
    }

    if (!config.enabled) {
      results.push({ name, status: "skipped", files: [] });
      continue;
    }

    try {
      const output = overrideOutput
        ? resolve(overrideOutput, name)
        : resolve(config.output);

      if (clean && !dryRun) {
        await rm(output, { recursive: true, force: true });
      }

      const files = await runSingleGenerator(
        name,
        config,
        ctx,
        output,
        dryRun,
        contractYaml,
      );
      results.push({ name, status: "success", files });
    } catch (err) {
      results.push({
        name,
        status: "failed",
        files: [],
        error: (err as Error).message,
      });
    }
  }

  return { generators: results };
}

async function runSingleGenerator(
  name: string,
  config: GeneratorConfig,
  ctx: NormalizedContext,
  outputPath: string,
  dryRun: boolean,
  contractYaml?: string,
): Promise<string[]> {
  const templates = config.templates;
  const options = config.options ?? {};

  if (templates === "builtin:markdown") {
    return runMarkdownGenerator(ctx, outputPath, options, dryRun);
  }

  if (templates === "builtin:typescript") {
    return runTypeScriptGenerator(ctx, outputPath, options, dryRun, contractYaml);
  }

  const language = LANGUAGE_GENERATORS[templates];
  if (language) {
    return writeFiles(outputPath, language(ctx, options, contractYaml), dryRun);
  }

  return runCustomGenerator(templates, ctx, outputPath, options, dryRun);
}

function requiredOption(options: Record<string, unknown>, name: string, templates: string): string {
  const value = options[name];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${templates} needs options.${name}`);
  }
  return value;
}

/** The generators of the languages whose programs run on a cli-contracts runtime. */
const LANGUAGE_GENERATORS: Record<
  string,
  (ctx: NormalizedContext, options: Record<string, unknown>, contractYaml?: string) => Record<string, string>
> = {
  "builtin:go": (ctx, options, contractYaml) =>
    generateGo(ctx, { package: requiredOption(options, "package", "builtin:go"), contractYaml }),
  "builtin:rust": (ctx, _options, contractYaml) => generateRust(ctx, { contractYaml }),
  "builtin:python": (ctx, _options, contractYaml) => generatePython(ctx, { contractYaml }),
  "builtin:php": (ctx, options, contractYaml) =>
    generatePhp(ctx, { namespace: requiredOption(options, "namespace", "builtin:php"), contractYaml }),
};

async function writeFiles(outputPath: string, output: Record<string, string>, dryRun: boolean): Promise<string[]> {
  const files: string[] = [];
  for (const [filename, content] of Object.entries(output)) {
    const filePath = resolve(outputPath, filename);
    files.push(filePath);
    if (!dryRun) {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");
    }
  }
  return files;
}

async function runMarkdownGenerator(
  ctx: NormalizedContext,
  outputPath: string,
  options: Record<string, unknown>,
  dryRun: boolean,
): Promise<string[]> {
  const md = generateMarkdown(ctx, {
    includeExamples: (options.includeExamples as boolean) ?? true,
    includeSchemas: (options.includeSchemas as boolean) ?? true,
    includeExtensions: (options.includeExtensions as boolean) ?? true,
    includeToc: true,
  });

  if (!dryRun) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, md, "utf-8");
  }

  return [outputPath];
}

async function runTypeScriptGenerator(
  ctx: NormalizedContext,
  outputPath: string,
  options: Record<string, unknown>,
  dryRun: boolean,
  contractYaml?: string,
): Promise<string[]> {
  const output = generateTypeScript(ctx, {
    emitTypes: (options.emitTypes as boolean) ?? true,
    emitClient: (options.emitClient as boolean) ?? true,
    emitValidators: (options.emitValidators as boolean) ?? true,
    contractYaml,
  });

  return writeFiles(outputPath, output, dryRun);
}

async function runCustomGenerator(
  templateDir: string,
  ctx: NormalizedContext,
  outputPath: string,
  options: Record<string, unknown>,
  dryRun: boolean,
): Promise<string[]> {
  const manifestPath = resolve(templateDir, "generator.yaml");
  const manifest = await loadGeneratorManifest(manifestPath);
  const renderResults = await renderCustomTemplates(
    templateDir,
    manifest,
    ctx,
    outputPath,
    options,
  );

  const files: string[] = [];
  for (const result of renderResults) {
    files.push(result.outputPath);
    if (!dryRun) {
      await mkdir(dirname(result.outputPath), { recursive: true });
      await writeFile(result.outputPath, result.content, "utf-8");
    }
  }

  return files;
}
