/**
 * A contract whose extracted output runs to hundreds of kilobytes — far past
 * one pipe buffer on every platform (8 KB for a Node 20 reader, 64 KB on
 * macOS, ~143 KB on Linux). A process that exits before its stdout drains
 * hands a reader on the other end of a pipe a visibly short read.
 */
export const LARGE_CONTRACT_COMMAND_SET = "big";

export function largeContractYaml(commandCount: number): string {
  const lines = [
    "cli_contracts: 0.1.0",
    "info:",
    "  title: Large CLI",
    "  version: 1.0.0",
    "command_sets:",
    `  ${LARGE_CONTRACT_COMMAND_SET}:`,
    "    commands:",
  ];
  for (let i = 0; i < commandCount; i++) {
    lines.push(
      `      cmd${i}:`,
      `        summary: ${`Command number ${i} does a thing. `.repeat(4).trim()}`,
      "        exits:",
      "          '0':",
      "            description: Success.",
    );
  }
  return lines.join("\n") + "\n";
}
