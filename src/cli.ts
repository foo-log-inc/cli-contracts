#!/usr/bin/env node

import { VERSION } from "./index.js";
import { createProgram } from "./generated/program.js";
import { CONTRACT_JSON_STR } from "./generated/contract.js";
import { optionFlags } from "./option-flags.js";
import type { Option } from "./types.js";
import type { Command } from "commander";
import type { CommandHandlers } from "./generated/program.js";
import { loadConfig, getContractFiles } from "./config.js";
import { runInit, FileExistsError } from "./commands/init.js";
import { runValidate } from "./commands/validate.js";
import { runVersionSync } from "./commands/version-sync.js";
import { runResolve } from "./commands/resolve.js";
import { runGenerate } from "./commands/generate.js";
import { runDocs } from "./commands/docs.js";
import { runDiff } from "./commands/diff.js";
import { runContractTests } from "./commands/test.js";
import { runExtract } from "./commands/extract.js";
import { runProposeAgentPolicy } from "./commands/propose-agent-policy.js";
import { runAuditCommand } from "./commands/audit.js";
import { runProposeTests } from "./commands/propose-tests.js";
import { runExplainDiff } from "./commands/explain-diff.js";
import { runSuggest } from "./commands/suggest.js";
import { runCheckReference } from "./commands/check-reference.js";
import { runBundle } from "./commands/bundle.js";
import { resolvedDsl } from "./generated/dsl/index.js";
import { EXIT_RUNTIME_MISSING, EXIT_ADAPTER_ERROR } from "./auditor/auditor.js";
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
      process.exitCode = 0;
    } catch (err) {
      if (err instanceof FileExistsError) {
        writeError("FILE_EXISTS", err.message);
        process.exitCode = 4;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async versionSync(options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file;
      const files = fileOpt && fileOpt.length > 0
        ? fileOpt
        : getContractFiles(configResult?.config);
      const result = await runVersionSync(files, {
        check: options.check,
        packageFile: options.packageFile,
      });
      writeOut(result, fmt);
      process.exitCode = result.checked && !result.inSync ? 9 : 0;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async validate(options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file;
      const files = fileOpt && fileOpt.length > 0
        ? fileOpt
        : getContractFiles(configResult?.config);
      const result = await runValidate(files, {
        strict: options.strict,
        resolveRefs: options.resolveRefs,
      });
      writeOut(result, fmt);
      process.exitCode = result.valid ? 0 : 9;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async resolve(options, parentOpts) {
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file;
      const files = fileOpt
        ? [fileOpt]
        : getContractFiles(configResult?.config);
      if (files.length === 0) {
        writeError("INVALID_ARGS", "No contract file specified");
        process.exitCode = 2;
        return;
      }
      const result = await runResolve(files[0], {
        format: getFormat(parentOpts),
      });
      process.stdout.write(result.output);
      process.exitCode = 0;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async generate(generators, options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file;
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
        process.exitCode = 3;
        return;
      }

      writeOut(result, fmt);
      const hasFailed = result.generators.some((g) => g.status === "failed");
      process.exitCode = hasFailed ? 5 : 0;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async docs(options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const fileOpt = options.file;
      const files = fileOpt && fileOpt.length > 0
        ? fileOpt
        : getContractFiles(configResult?.config);
      const result = await runDocs(files, { output: options.output });

      if ("validationFailed" in result) {
        writeOut(result.result, fmt);
        process.exitCode = 3;
        return;
      }

      writeOut(result, fmt);
      process.exitCode = 0;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
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
        profile: options.profile ?? config?.contract_tests?.profile,
        caseIds: options.case,
        casesDir: options.casesDir ?? config?.contract_tests?.cases_dir,
        timeoutMs: options.timeout ? Number(options.timeout) : 30000,
        bail: options.bail,
        env: config?.contract_tests?.env,
        executionProfiles: config?.execution_profiles,
      });

      writeOut(result, fmt);
      process.exitCode = result.failed > 0 ? 6 : 0;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async diff(old, newArg, options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      if (!old || !newArg) {
        writeError("INVALID_ARGS", "Both old and new contract files are required");
        process.exitCode = 2;
        return;
      }
      const result = await runDiff(old, newArg, {
        breakingOnly: options.breakingOnly,
      });
      writeOut(result, fmt);
      process.exitCode = result.has_breaking_changes ? 7 : 0;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async proposeAgentPolicy(contract, options, parentOpts) {
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const files = contract
        ? [contract]
        : options.file
          ? [options.file]
          : getContractFiles(configResult?.config);

      const ret = await runProposeAgentPolicy(files, options);
      if (typeof ret === "string") return ret;

      const { result, exitCode } = ret;

      if (options.reportFormat === "text") {
        process.stdout.write(typeof result === "string" ? result : JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
      process.exitCode = exitCode;
    } catch (err) {
      const exitCode = (err as { exitCode?: number }).exitCode;
      if (exitCode === EXIT_RUNTIME_MISSING) {
        writeError("RUNTIME_MISSING", (err as Error).message);
        process.exitCode = 11;
        return;
      }
      if (exitCode === EXIT_ADAPTER_ERROR) {
        writeError("ADAPTER_ERROR", (err as Error).message);
        process.exitCode = 12;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async audit(contract, options, parentOpts) {
    try {
      const configResult = await loadConfig(
        parentOpts.config as string | undefined,
      );
      const files = contract
        ? [contract]
        : options.file
          ? [options.file]
          : getContractFiles(configResult?.config);

      const ret = await runAuditCommand(files, options);
      if (typeof ret === "string") return ret;

      const { result, exitCode } = ret;

      if (options.reportFormat === "text") {
        process.stdout.write(typeof result === "string" ? result : JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
      process.exitCode = exitCode;
    } catch (err) {
      const exitCode = (err as { exitCode?: number }).exitCode;
      if (exitCode === EXIT_RUNTIME_MISSING) {
        writeError("RUNTIME_MISSING", (err as Error).message);
        process.exitCode = 11;
        return;
      }
      if (exitCode === EXIT_ADAPTER_ERROR) {
        writeError("ADAPTER_ERROR", (err as Error).message);
        process.exitCode = 12;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async proposeTests(contract, options, _parentOpts) {
    try {
      const configResult = await loadConfig(
        _parentOpts.config as string | undefined,
      );
      const files = contract
        ? [contract]
        : options.file
          ? [options.file]
          : getContractFiles(configResult?.config);

      const ret = await runProposeTests(files, options);
      if (typeof ret === "string") return ret;

      const { result, exitCode } = ret;

      if (options.reportFormat === "text") {
        process.stdout.write(typeof result === "string" ? result : JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
      process.exitCode = exitCode;
    } catch (err) {
      const exitCode = (err as { exitCode?: number }).exitCode;
      if (exitCode === EXIT_RUNTIME_MISSING) {
        writeError("RUNTIME_MISSING", (err as Error).message);
        process.exitCode = 11;
        return;
      }
      if (exitCode === EXIT_ADAPTER_ERROR) {
        writeError("ADAPTER_ERROR", (err as Error).message);
        process.exitCode = 12;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async explainDiff(old, newArg, options, _parentOpts) {
    try {
      const ret = await runExplainDiff(old, newArg, options);
      if (typeof ret === "string") return ret;

      const { result, exitCode } = ret;

      if (options.reportFormat === "text") {
        process.stdout.write(typeof result === "string" ? result : JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
      process.exitCode = exitCode;
    } catch (err) {
      const exitCode = (err as { exitCode?: number }).exitCode;
      if (exitCode === EXIT_RUNTIME_MISSING) {
        writeError("RUNTIME_MISSING", (err as Error).message);
        process.exitCode = 11;
        return;
      }
      if (exitCode === EXIT_ADAPTER_ERROR) {
        writeError("ADAPTER_ERROR", (err as Error).message);
        process.exitCode = 12;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async checkReference(contract, options, _parentOpts) {
    try {
      const configResult = await loadConfig(
        _parentOpts.config as string | undefined,
      );
      const files = contract
        ? [contract]
        : options.file
          ? [options.file]
          : getContractFiles(configResult?.config);

      const ret = await runCheckReference(files, {
        ...options,
        scope: options.scope as "contract" | "implementation" | "all" | undefined,
      });
      if (typeof ret === "string") return ret;

      const { result, exitCode } = ret;

      if (options.reportFormat === "text") {
        process.stdout.write(typeof result === "string" ? result : JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
      process.exitCode = exitCode;
    } catch (err) {
      const exitCode = (err as { exitCode?: number }).exitCode;
      if (exitCode === EXIT_RUNTIME_MISSING) {
        writeError("RUNTIME_MISSING", (err as Error).message);
        process.exitCode = 11;
        return;
      }
      if (exitCode === EXIT_ADAPTER_ERROR) {
        writeError("ADAPTER_ERROR", (err as Error).message);
        process.exitCode = 12;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async suggest(options, _parentOpts) {
    try {
      const ret = await runSuggest(options);
      if (typeof ret === "string") return ret;

      const { result, exitCode } = ret;

      if (options.reportFormat === "text") {
        process.stdout.write(typeof result === "string" ? result : JSON.stringify(result, null, 2) + "\n");
      } else if (options.reportFormat === "yaml") {
        const yaml = await import("yaml");
        process.stdout.write(yaml.stringify(result) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
      process.exitCode = exitCode;
    } catch (err) {
      const exitCode = (err as { exitCode?: number }).exitCode;
      if (exitCode === EXIT_RUNTIME_MISSING) {
        writeError("RUNTIME_MISSING", (err as Error).message);
        process.exitCode = 11;
        return;
      }
      if (exitCode === EXIT_ADAPTER_ERROR) {
        writeError("ADAPTER_ERROR", (err as Error).message);
        process.exitCode = 12;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async bundle(options, _parentOpts) {
    try {
      const ret = await runBundle(options);
      if (typeof ret === "string") return ret;

      const { result, exitCode } = ret;

      if (options.reportFormat === "text") {
        process.stdout.write(typeof result === "string" ? result : JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
      process.exitCode = exitCode;
    } catch (err) {
      const exitCode = (err as { exitCode?: number }).exitCode;
      if (exitCode === EXIT_RUNTIME_MISSING) {
        writeError("RUNTIME_MISSING", (err as Error).message);
        process.exitCode = 11;
        return;
      }
      if (exitCode === EXIT_ADAPTER_ERROR) {
        writeError("ADAPTER_ERROR", (err as Error).message);
        process.exitCode = 12;
        return;
      }
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },

  async agents(_options, parentOpts) {
    const YAML = await import("yaml");
    const format = getFormat(parentOpts);
    try {
      if (format === "json") {
        process.stdout.write(JSON.stringify(resolvedDsl, null, 2) + "\n");
      } else {
        process.stdout.write(YAML.stringify(resolvedDsl, { lineWidth: 120 }) + "\n");
      }
    } catch (err) {
      process.stderr.write(`Failed to output DSL: ${(err as Error).message}\n`);
      process.exitCode = 1;
    }
  },

  async extract(commands, options, parentOpts) {
    const fmt = getFormat(parentOpts);
    try {
      if (commands.length === 0 && !options.all) {
        writeError("INVALID_ARGS", "Specify command IDs or use --all");
        process.exitCode = 2;
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

      const result = await runExtract(files, cmdIds, {
        format: fmt,
        includeMeta: options.includeMeta,
      });
      process.stdout.write(result.output);
      process.exitCode = 0;
    } catch (err) {
      writeError("UNEXPECTED", (err as Error).message);
      process.exitCode = 1;
    }
  },
};

interface DeclaredCommand {
  options?: Option[];
  exits: Record<string, unknown>;
}

interface DeclaredCommandSet {
  global_options?: Option[];
  commands: Record<string, DeclaredCommand>;
}

let embeddedContract: { command_sets: Record<string, DeclaredCommandSet> } | undefined;

/** The command set that declares a command, from the contract embedded in this CLI. */
function declaringCommandSet(commandName: string): DeclaredCommandSet | undefined {
  embeddedContract ??= JSON.parse(CONTRACT_JSON_STR) as { command_sets: Record<string, DeclaredCommandSet> };
  return Object.values(embeddedContract.command_sets).find((cs) => cs.commands[commandName] !== undefined);
}

/**
 * Whether the contract declares exit 2 (invalid arguments, with an Error JSON
 * on stderr) for the command commander rejected the arguments of.
 */
function declaresInvalidArgumentsExit(commandName: string): boolean {
  return declaringCommandSet(commandName)?.commands[commandName].exits["2"] !== undefined;
}

/**
 * The first option value outside the enum the contract declares for it,
 * worded as commander words an invalid argument.
 */
function enumViolation(program: Command, actionCommand: Command): string | undefined {
  const cs = declaringCommandSet(actionCommand.name());
  if (!cs) return undefined;
  const scopes: Array<[Option[], Record<string, unknown>]> = [
    [cs.global_options ?? [], program.opts()],
    [cs.commands[actionCommand.name()].options ?? [], actionCommand.opts()],
  ];
  for (const [options, values] of scopes) {
    for (const opt of options) {
      const allowed = opt.schema?.enum;
      if (!allowed) continue;
      const value = values[optionFlags(opt).key];
      const given = value === undefined ? [] : Array.isArray(value) ? value : [value];
      const outside = given.find((v) => !allowed.includes(v));
      if (outside !== undefined) {
        return `error: option '${optionFlags(opt).flags}' argument '${String(outside)}' is invalid. Allowed choices are ${allowed.join(", ")}.`;
      }
    }
  }
  return undefined;
}

const program = createProgram(handlers, VERSION, {
  onUsageError(error, command) {
    if (declaresInvalidArgumentsExit(command.name())) {
      writeError("INVALID_ARGS", error.message);
      return 2;
    }
    // No exit declared for it: commander's own message and exit.
    process.stderr.write(`${error.message}\n`);
    return error.exitCode;
  },
});
// The contract declares the values an option takes; one outside them is an
// invalid argument, and ends like the ones commander finds.
program.hook("preAction", (thisCommand, actionCommand) => {
  const violation = enumViolation(thisCommand, actionCommand);
  if (violation) actionCommand.error(violation, { code: "commander.invalidArgument" });
});
program.parse();
