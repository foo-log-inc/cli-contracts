import { resolve, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { parseContractFile } from "../parser.js";
import { validateContract } from "../validator.js";
import { resolveRefs } from "../ref-resolver.js";
import { normalizeContract } from "../normalizer.js";
import { generateMarkdown } from "../generators/markdown.js";
import type { GenerateResult, ValidateResult } from "../types.js";

export interface DocsOptions {
  file?: string[];
  output?: string;
}

export async function runDocs(
  contractFiles: string[],
  options: DocsOptions = {},
): Promise<GenerateResult | { validationFailed: true; result: ValidateResult }> {
  const outputPath = resolve(options.output ?? "docs/cli-reference.md");
  const generatedFiles: string[] = [];

  for (const file of contractFiles) {
    const filePath = resolve(file);
    let doc = await parseContractFile(filePath);
    const validation = validateContract(doc, { basePath: dirname(filePath) });

    if (!validation.valid) {
      return { validationFailed: true, result: validation };
    }

    doc = resolveRefs(doc, { basePath: dirname(filePath) });
    const ctx = normalizeContract(doc);
    const md = generateMarkdown(ctx);

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, md, "utf-8");
    generatedFiles.push(outputPath);
  }

  return {
    generators: [
      {
        name: "markdown",
        status: "success",
        files: generatedFiles,
      },
    ],
  };
}
