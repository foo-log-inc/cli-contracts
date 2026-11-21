// The Python conformance programs: the generated package, a handler that
// writes what it receives, and a main that runs every invocation in one process.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePython, pythonHandlerSignature, pythonSnake, pythonString } from "../../../src/generators/python.js";
import type { SpecCommand } from "../../../src/generators/runtime-spec.js";
import {
  FAILING_COMMAND,
  HANDLER_PREFIX,
  PROGRAM_VERSION,
  PROMPT_PREFIX,
  REPO,
  USAGE_PREFIX,
  type ConformanceContract,
} from "../shared.js";

function handlerMethod(cmd: SpecCommand): string {
  const args = cmd.arguments.map((arg) => pythonSnake(arg.name));
  const lines = [`    ${pythonHandlerSignature(cmd, "gen.program.")}:`];
  lines.push(`        self.record(${pythonString(cmd.id)}, [${args.join(", ")}], options, parent_opts)`);
  const code = cmd.id === FAILING_COMMAND.id ? FAILING_COMMAND.exitCode : 0;
  if (cmd.llm) {
    const first = cmd.arguments[0];
    const text = !first ? '"undefined"' : first.variadic ? `",".join(${args[0]})` : first.required ? args[0] : `(${args[0]} if ${args[0]} is not None else "undefined")`;
    lines.push(`        return (${code}, ${pythonString(PROMPT_PREFIX)} + ${text})`);
  } else {
    lines.push(`        return ${code}`);
  }
  return lines.join("\n");
}

function mainSource(c: ConformanceContract, workDir: string): string {
  const commands = [...new Map(c.spec.commands.map((cmd) => [cmd.id, cmd])).values()];
  const cases = c.argv.map((argv) => `    [${argv.map(pythonString).join(", ")}],`).join("\n");
  return `import io
import sys

sys.path.insert(0, ${pythonString(join(REPO, "python"))})
sys.path.insert(0, ${pythonString(workDir)})

import cli_contracts_runtime as rt  # noqa: E402

import gen_${c.name} as gen  # noqa: E402
import gen_${c.name}.program  # noqa: E402,F401
from typing import Any, Dict, List, Optional, Tuple, Union  # noqa: E402,F401


def _sorted(o):
    return {k: o[k] for k in sorted(o)}


class Handlers:
    def __init__(self) -> None:
        self.stdout = io.StringIO()

    def record(self, command_id, args, opts, parent_opts):
        line = {"command": command_id, "args": args, "opts": _sorted(opts), "globals": _sorted(parent_opts)}
        self.stdout.write(${pythonString(HANDLER_PREFIX)} + rt.stringify(line) + "\\n")

${commands.map(handlerMethod).join("\n\n")}


CASES = [
${cases}
]


def main() -> None:
    results = {}
    for variant in ("plain", "usage"):
        handlers = Handlers()
        state = {"stderr": io.StringIO()}

        def on_usage_error(err, command):
            line = {"code": err.code, "exitCode": err.exit_code, "message": err.message, "command": command.name}
            state["stderr"].write(${pythonString(USAGE_PREFIX)} + rt.stringify(line) + "\\n")
            return 2

        program = gen.create_program(handlers, ${pythonString(PROGRAM_VERSION)}, on_usage_error if variant == "usage" else None)
        outcomes = []
        for argv in CASES:
            handlers.stdout = io.StringIO()
            state["stderr"] = io.StringIO()
            code = program.run(argv, handlers.stdout, state["stderr"])
            outcomes.append({"exitCode": code, "stdout": handlers.stdout.getvalue(), "stderr": state["stderr"].getvalue()})
        results[variant] = outcomes
    with open(sys.argv[1], "w", encoding="utf-8") as f:
        f.write(rt.stringify(results))


main()
`;
}

export function preparePython(contracts: ConformanceContract[], workDir: string): string {
  const lines = [`cd ${JSON.stringify(workDir)}`];
  const files: string[] = [];
  for (const c of contracts) {
    const dir = join(workDir, `gen_${c.name}`);
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(generatePython(c.ctx, { contractYaml: c.yaml }))) {
      writeFileSync(join(dir, file), content);
      files.push(join(`gen_${c.name}`, file));
    }
    writeFileSync(join(workDir, `main_${c.name}.py`), mainSource(c, workDir));
  }
  lines.push(`python3 -m py_compile ${files.join(" ")}`);
  for (const c of contracts) {
    lines.push(`python3 main_${c.name}.py ${JSON.stringify(join(workDir, `${c.name}.json`))}`);
  }
  return lines.join("\n");
}
