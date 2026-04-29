import type {
  CliContractsDocument,
  NormalizedContext,
  NormalizedCommandSet,
  NormalizedCommand,
  NormalizedExit,
  Option,
} from "./types.js";

/**
 * Converts a parsed contract document into a normalized generator context.
 * Maps are converted to arrays for template iteration. Derived fields
 * (path, invocation, fullId) are computed.
 */
export function normalizeContract(
  doc: CliContractsDocument,
): NormalizedContext {
  const commandSets: NormalizedCommandSet[] = [];

  for (const [setId, cs] of Object.entries(doc.commandSets)) {
    const executable = cs.executable ?? setId;
    const globalOptions: Option[] = cs.globalOptions ?? [];

    const commands: NormalizedCommand[] = [];
    for (const [cmdId, cmd] of Object.entries(cs.commands)) {
      const pathSegments = cmd.path ?? cmdId.split(".");
      const invocation = [executable, ...pathSegments].join(" ");

      const exits: NormalizedExit[] = [];
      for (const [code, exit] of Object.entries(cmd.exits)) {
        exits.push({
          exitCode: Number(code),
          description: exit.description,
          stdout: exit.stdout,
          stderr: exit.stderr,
          files: exit.files,
        });
      }
      exits.sort((a, b) => a.exitCode - b.exitCode);

      const extensions: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(cmd)) {
        if (key.startsWith("x-")) {
          extensions[key] = val;
        }
      }

      commands.push({
        id: cmdId,
        fullId: `${setId}.${cmdId}`,
        path: pathSegments,
        invocation,
        summary: cmd.summary,
        description: cmd.description,
        usage: cmd.usage,
        arguments: cmd.arguments ?? [],
        options: cmd.options ?? [],
        allOptions: [...globalOptions, ...(cmd.options ?? [])],
        streams: cmd.streams,
        signals: cmd.signals,
        exits,
        examples: cmd.examples,
        deprecated: cmd.deprecated,
        extensions,
      });
    }

    const setExtensions: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(cs)) {
      if (key.startsWith("x-")) {
        setExtensions[key] = val;
      }
    }

    commandSets.push({
      id: setId,
      executable,
      summary: cs.summary,
      description: cs.description,
      globalOptions,
      env: cs.env ?? {},
      commands,
      extensions: setExtensions,
    });
  }

  return {
    specVersion: doc.cliContracts,
    info: doc.info,
    commandSets,
    components: doc.components ?? {},
  };
}
