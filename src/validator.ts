/**
 * Semantic validator for CLI Contracts documents.
 *
 * Structural validation (required fields, types, value constraints) is
 * handled by the Zod schema in schema.ts at parse time. This module
 * performs higher-level semantic checks that cannot be expressed in
 * a JSON Schema / Zod schema:
 *
 *  - duplicate command paths within a command set
 *  - duplicate argument / option names
 *  - duplicate option aliases
 *  - variadic argument placement
 *  - exit code range (0-255)
 *  - stream schema vs framing conflict
 *  - unresolved $ref targets
 *  - empty command set warnings
 */

import type {
  CliContractsDocument,
  CommandSet,
  Command,
  Option,
  Argument,
  Diagnostic,
  ValidateResult,
} from "./types.js";
import { validateRefs } from "./ref-resolver.js";

export function validateContract(doc: CliContractsDocument): ValidateResult {
  const diagnostics: Diagnostic[] = [];

  validateCommandSets(doc, diagnostics);
  validateRefsIntegrity(doc, diagnostics);

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  return {
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
  };
}

function validateCommandSets(
  doc: CliContractsDocument,
  diagnostics: Diagnostic[],
): void {
  for (const setId of Object.keys(doc.commandSets)) {
    const basePath = `/commandSets/${setId}`;
    const cs = doc.commandSets[setId];

    if (cs.globalOptions) {
      validateOptions(cs.globalOptions, `${basePath}/globalOptions`, diagnostics);
    }

    validateCommands(cs, setId, basePath, diagnostics);
  }
}

function validateCommands(
  cs: CommandSet,
  setId: string,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const cmdIds = Object.keys(cs.commands);
  if (cmdIds.length === 0) {
    diagnostics.push({
      path: `${basePath}/commands`,
      message: `Command set "${setId}" has no commands`,
      rule: "empty-commands",
      severity: "warning",
    });
    return;
  }

  const pathMap = new Map<string, string>();
  for (const cmdId of cmdIds) {
    const cmd = cs.commands[cmdId];
    const cmdPath = (cmd.path ?? cmdId.split(".")).join(" ");
    if (pathMap.has(cmdPath)) {
      diagnostics.push({
        path: `${basePath}/commands/${cmdId}`,
        message: `Duplicate command path "${cmdPath}" (conflicts with "${pathMap.get(cmdPath)}")`,
        rule: "duplicate-command-path",
        severity: "error",
      });
    } else {
      pathMap.set(cmdPath, cmdId);
    }

    validateCommand(cmd, cmdId, `${basePath}/commands/${cmdId}`, diagnostics);
  }
}

function validateCommand(
  cmd: Command,
  _cmdId: string,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  validateExits(cmd, basePath, diagnostics);

  if (cmd.arguments) {
    validateArguments(cmd.arguments, basePath, diagnostics);
  }

  if (cmd.options) {
    validateOptions(cmd.options, `${basePath}/options`, diagnostics);
  }

  if (cmd.streams) {
    validateStreams(cmd, basePath, diagnostics);
  }
}

function validateExits(
  cmd: Command,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  for (const [code] of Object.entries(cmd.exits)) {
    const numCode = Number(code);
    if (!Number.isInteger(numCode) || numCode < 0 || numCode > 255) {
      diagnostics.push({
        path: `${basePath}/exits/${code}`,
        message: `Invalid exit code "${code}" (must be integer 0-255)`,
        rule: "invalid-exit-code",
        severity: "error",
      });
    }
  }
}

function validateArguments(
  args: Argument[],
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const argNames = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const argPath = `${basePath}/arguments/${i}`;

    if (argNames.has(arg.name)) {
      diagnostics.push({
        path: argPath,
        message: `Duplicate argument name "${arg.name}"`,
        rule: "duplicate-argument-name",
        severity: "error",
      });
    }
    argNames.add(arg.name);

    if (arg.variadic && i < args.length - 1) {
      diagnostics.push({
        path: argPath,
        message: `Variadic argument "${arg.name}" must be the last argument`,
        rule: "variadic-not-last",
        severity: "error",
      });
    }
  }
}

function validateOptions(
  opts: Option[],
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const optNames = new Set<string>();
  const aliasMap = new Map<string, string>();

  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i];
    const optPath = `${basePath}/${i}`;

    if (optNames.has(opt.name)) {
      diagnostics.push({
        path: optPath,
        message: `Duplicate option name "${opt.name}"`,
        rule: "duplicate-option-name",
        severity: "error",
      });
    }
    optNames.add(opt.name);

    if (opt.aliases) {
      for (const alias of opt.aliases) {
        if (aliasMap.has(alias)) {
          diagnostics.push({
            path: optPath,
            message: `Duplicate alias "${alias}" (already used by "${aliasMap.get(alias)}")`,
            rule: "duplicate-option-alias",
            severity: "error",
          });
        } else {
          aliasMap.set(alias, opt.name);
        }
      }
    }
  }
}

function validateStreams(
  cmd: Command,
  basePath: string,
  diagnostics: Diagnostic[],
): void {
  const streams = cmd.streams!;
  for (const [key, stream] of Object.entries(streams)) {
    if (!stream) continue;
    const streamPath = `${basePath}/streams/${key}`;

    if (stream.framing && stream.schema) {
      diagnostics.push({
        path: streamPath,
        message: `Stream "${key}" has both "framing" and "schema"; use "itemSchema" with framing`,
        rule: "stream-schema-conflict",
        severity: "warning",
      });
    }
  }
}

function validateRefsIntegrity(
  doc: CliContractsDocument,
  diagnostics: Diagnostic[],
): void {
  const { unresolvedRefs } = validateRefs(doc);
  for (const ref of unresolvedRefs) {
    diagnostics.push({
      path: ref,
      message: `Unresolved $ref "${ref}"`,
      rule: "unresolved-ref",
      severity: "error",
    });
  }
}
