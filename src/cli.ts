#!/usr/bin/env node

import { VERSION } from "./index.js";
import { createProgram } from "./generated/program.js";
import type { CommandHandlers } from "./generated/program.js";
import { loadConfig, getContractFiles } from "./config.js";
import { runInit, FileExistsError } from "./commands/init.js";
import { runValidate } from "./commands/validate.js";
import { runGenerate } from "./commands/generate.js";
import { runDocs } from "./commands/docs.js";
import { runDiff } from "./commands/diff.js";
import { runContractTests } from "./commands/test.js";
import { runExtract } from "./commands/extract.js";
import { formatOutput, resolveFormat, type OutputFormat } from "./output.js";

function getFormat(parentOpts: Record<string, unknown>): OutputFormat {
  return resolveFormat(parentOpts.format);
}

function writeOut(data: unknown, format: OutputFormat): void {
  process.stdout.write(formatOutput(data, format));
}

function writeError(code: string, message: string): void {
  process.stderr.write(JSON.stringify({ code, message }, null, 2) + "\n");
}

const handlers: CommandHandlers = {
  async init(options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const result = await runInit({
        name: options.name,
        multiCommandSet: options.multiCommandSet,
        output: options.output,
        withConfig: options.withConfig,
      });
      writeOut(result, fmt);
      process.exit(0);
    } catch (err) {
      if (err instanceof FileExistsError) {
        writeError("FILE_EXISTS", err.message);
        process.exit(4);
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exit(1);
    }
  },

  async validate(options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file as unknown as string[] | undefined;
      const files = fileOpt && fileOpt.length > 0
        ? fileOpt
        : getContractFiles(configResult?.config);
      const result = await runValidate(files, {
        strict: options.strict,
        resolveRefs: options.resolveRefs,
      });
      writeOut(result, fmt);
      process.exit(result.valid ? 0 : 3);
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exit(1);
    }
  },

  async generate(generators, options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file as unknown as string[] | undefined;
      const files = fileOpt && fileOpt.length > 0
        ? fileOpt
        : getContractFiles(configResult?.config);
      const result = await runGenerate(files, {
        generators: generators.length > 0 ? generators : undefined,
        output: options.output,
        dryRun: options.dryRun,
        clean: options.clean,
        config: configResult?.config,
      });

      if ("validationFailed" in result) {
        writeOut(result.result, fmt);
        process.exit(3);
      }

      writeOut(result, fmt);
      const hasFailed = result.generators.some((g) => g.status === "failed");
      process.exit(hasFailed ? 5 : 0);
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exit(1);
    }
  },

  async docs(options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file as unknown as string[] | undefined;
      const files = fileOpt && fileOpt.length > 0
        ? fileOpt
        : getContractFiles(configResult?.config);
      const result = await runDocs(files, { output: options.output });

      if ("validationFailed" in result) {
        writeOut(result.result, fmt);
        process.exit(3);
      }

      writeOut(result, fmt);
      process.exit(0);
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exit(1);
    }
  },

  async test(options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const config = configResult?.config;
      const files = getContractFiles(config);
      const result = await runContractTests(files, {
        profile: options.profile ?? config?.contractTests?.profile,
        caseIds: options.case ? [options.case] : undefined,
        casesDir: options.casesDir ?? config?.contractTests?.casesDir,
        timeoutMs: options.timeout ? Number(options.timeout) : 30000,
        bail: options.bail,
        env: config?.contractTests?.env,
        executionProfiles: config?.executionProfiles,
      });

      writeOut(result, fmt);
      process.exit(result.failed > 0 ? 6 : 0);
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exit(1);
    }
  },

  async diff(old, newArg, options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      if (!old || !newArg) {
        writeError("INVALID_ARGS", "Both old and new contract files are required");
        process.exit(2);
        return;
      }
      const result = await runDiff(old, newArg, {
        breakingOnly: options.breakingOnly,
      });
      writeOut(result, fmt);
      process.exit(result.hasBreakingChanges ? 7 : 0);
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exit(1);
    }
  },

  async extract(commands, options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      if (commands.length === 0 && !options.all) {
        writeError("INVALID_ARGS", "Specify command IDs or use --all");
        process.exit(2);
        return;
      }
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const files = options.file
        ? [options.file]
        : getContractFiles(configResult?.config);

      const allFlag = options.all;
      const cmdIds = allFlag ? [] : commands;

      const result = await runExtract(files, cmdIds, { format: fmt });
      process.stdout.write(result.output);
      process.exit(0);
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exit(1);
    }
  },
};

const program = createProgram(handlers, VERSION);
program.parse();
