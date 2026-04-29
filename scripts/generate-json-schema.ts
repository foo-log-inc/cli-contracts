#!/usr/bin/env npx tsx
/**
 * Generates JSON Schema files from the Zod schema definitions.
 *
 * Usage: npx tsx scripts/generate-json-schema.ts
 *
 * Outputs:
 *   schemas/cli-contract.schema.json
 *   schemas/cli-contracts.config.schema.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  CliContractsDocumentSchema,
  CliContractsConfigSchema,
} from "../src/schema.js";

const SCHEMAS_DIR = resolve(import.meta.dirname ?? dirname(""), "../schemas");

mkdirSync(SCHEMAS_DIR, { recursive: true });

function generate(
  filename: string,
  zodSchema: Parameters<typeof zodToJsonSchema>[0],
  title: string,
  description: string,
): void {
  const jsonSchema = zodToJsonSchema(zodSchema, {
    name: title,
    $refStrategy: "none",
  });

  const output = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title,
    description,
    ...jsonSchema,
  };

  const outPath = resolve(SCHEMAS_DIR, filename);
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`  ${outPath}`);
}

console.log("Generating JSON Schema files...");

generate(
  "cli-contract.schema.json",
  CliContractsDocumentSchema,
  "CLI Contracts Document",
  "Schema for cli-contract.yaml — the contract-first CLI interface definition.",
);

generate(
  "cli-contracts.config.schema.json",
  CliContractsConfigSchema,
  "CLI Contracts Config",
  "Schema for cli-contracts.config.yaml — tooling configuration for validation, generation, and testing.",
);

console.log("Done.");
