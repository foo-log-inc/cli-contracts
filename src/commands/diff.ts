import { resolve, dirname } from "node:path";
import { parseContractFile } from "../parser.js";
import { resolveRefs } from "../ref-resolver.js";
import type { CliContractsDocument, DiffResult, DiffChange } from "../types.js";

export interface DiffOptions {
  breakingOnly?: boolean;
}

export async function runDiff(
  oldFile: string,
  newFile: string,
  options: DiffOptions = {},
): Promise<DiffResult> {
  const oldPath = resolve(oldFile);
  const newPath = resolve(newFile);
  const oldDoc = resolveRefs(await parseContractFile(oldPath), { basePath: dirname(oldPath) });
  const newDoc = resolveRefs(await parseContractFile(newPath), { basePath: dirname(newPath) });

  const changes = diffContracts(oldDoc, newDoc);
  const filtered = options.breakingOnly
    ? changes.filter((c) => c.breaking)
    : changes;

  return {
    has_breaking_changes: filtered.some((c) => c.breaking),
    breaking_count: filtered.filter((c) => c.breaking).length,
    non_breaking_count: filtered.filter((c) => !c.breaking).length,
    changes: filtered,
  };
}

function diffContracts(
  oldDoc: CliContractsDocument,
  newDoc: CliContractsDocument,
): DiffChange[] {
  const changes: DiffChange[] = [];

  const oldSets = Object.keys(oldDoc.command_sets);
  const newSets = Object.keys(newDoc.command_sets);

  for (const setId of oldSets) {
    if (!newSets.includes(setId)) {
      changes.push({
        type: "removed",
        path: `/command_sets/${setId}`,
        breaking: true,
        description: `Command set "${setId}" was removed`,
      });
      continue;
    }

    const oldCs = oldDoc.command_sets[setId];
    const newCs = newDoc.command_sets[setId];

    if (oldCs.executable !== newCs.executable && newCs.executable !== undefined) {
      changes.push({
        type: "changed",
        path: `/command_sets/${setId}/executable`,
        breaking: true,
        description: `Executable changed from "${oldCs.executable ?? setId}" to "${newCs.executable}"`,
      });
    }

    const oldCmds = Object.keys(oldCs.commands);
    const newCmds = Object.keys(newCs.commands);

    for (const cmdId of oldCmds) {
      if (!newCmds.includes(cmdId)) {
        changes.push({
          type: "removed",
          path: `/command_sets/${setId}/commands/${cmdId}`,
          breaking: true,
          description: `Command "${cmdId}" was removed from "${setId}"`,
        });
        continue;
      }

      const oldCmd = oldCs.commands[cmdId];
      const newCmd = newCs.commands[cmdId];

      // Check exit code changes
      const oldExits = Object.keys(oldCmd.exits ?? {});
      const newExits = Object.keys(newCmd.exits ?? {});
      for (const code of oldExits) {
        if (!newExits.includes(code)) {
          changes.push({
            type: "removed",
            path: `/command_sets/${setId}/commands/${cmdId}/exits/${code}`,
            breaking: true,
            description: `Exit code ${code} removed from "${cmdId}"`,
          });
        }
      }
      for (const code of newExits) {
        if (!oldExits.includes(code)) {
          changes.push({
            type: "added",
            path: `/command_sets/${setId}/commands/${cmdId}/exits/${code}`,
            breaking: false,
            description: `Exit code ${code} added to "${cmdId}"`,
          });
        }
      }

      // Check removed options
      const oldOpts = (oldCmd.options ?? []).map((o) => o.name);
      const newOpts = (newCmd.options ?? []).map((o) => o.name);
      for (const optName of oldOpts) {
        if (!newOpts.includes(optName)) {
          changes.push({
            type: "removed",
            path: `/command_sets/${setId}/commands/${cmdId}/options/${optName}`,
            breaking: true,
            description: `Option "--${optName}" removed from "${cmdId}"`,
          });
        }
      }
      for (const optName of newOpts) {
        if (!oldOpts.includes(optName)) {
          const newOpt = newCmd.options!.find((o) => o.name === optName)!;
          changes.push({
            type: "added",
            path: `/command_sets/${setId}/commands/${cmdId}/options/${optName}`,
            breaking: !!newOpt.required,
            description: `Option "--${optName}" added to "${cmdId}"${newOpt.required ? " (required — breaking)" : ""}`,
          });
        }
      }

      // Check removed arguments
      const oldArgs = (oldCmd.arguments ?? []).map((a) => a.name);
      const newArgs = (newCmd.arguments ?? []).map((a) => a.name);
      for (const argName of oldArgs) {
        if (!newArgs.includes(argName)) {
          changes.push({
            type: "removed",
            path: `/command_sets/${setId}/commands/${cmdId}/arguments/${argName}`,
            breaking: true,
            description: `Argument "${argName}" removed from "${cmdId}"`,
          });
        }
      }
      for (const argName of newArgs) {
        if (!oldArgs.includes(argName)) {
          const newArg = newCmd.arguments!.find((a) => a.name === argName)!;
          changes.push({
            type: "added",
            path: `/command_sets/${setId}/commands/${cmdId}/arguments/${argName}`,
            breaking: !!newArg.required,
            description: `Argument "${argName}" added to "${cmdId}"${newArg.required ? " (required — breaking)" : ""}`,
          });
        }
      }
    }

    for (const cmdId of newCmds) {
      if (!oldCmds.includes(cmdId)) {
        changes.push({
          type: "added",
          path: `/command_sets/${setId}/commands/${cmdId}`,
          breaking: false,
          description: `Command "${cmdId}" added to "${setId}"`,
        });
      }
    }
  }

  for (const setId of newSets) {
    if (!oldSets.includes(setId)) {
      changes.push({
        type: "added",
        path: `/command_sets/${setId}`,
        breaking: false,
        description: `Command set "${setId}" was added`,
      });
    }
  }

  return changes;
}
