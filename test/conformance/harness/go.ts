// The Go conformance programs: the generated package, a handler that writes
// what it receives, and a main that runs every invocation in one process.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateGo, goExported, goLiteral, goParam, goString } from "../../../src/generators/go.js";
import { buildTypeModel } from "../../../src/generators/type-model.js";
import { CLIENT_CASES } from "../cases.js";
import type { SpecCommand } from "../../../src/generators/runtime-spec.js";
import {
  ARGV_SCRIPT,
  FAILING_COMMAND,
  HANDLER_PREFIX,
  PROGRAM_VERSION,
  PROMPT_PREFIX,
  REPO,
  USAGE_PREFIX,
  type ConformanceContract,
} from "../shared.js";

function handlerMethod(cmd: SpecCommand): string {
  const params = cmd.arguments.map((arg) => {
    const type = arg.variadic ? "[]string" : arg.required ? "string" : "*string";
    return `${goParam(arg.name)} ${type}`;
  });
  params.push(`options gen.${goExported(cmd.id)}HandlerOptions`, "parentOpts *rt.Object");
  const lines: string[] = [];
  lines.push(`func (h *handlers) ${goExported(cmd.id)}(${params.join(", ")}) ${cmd.llm ? "(int, *string)" : "int"} {`);
  lines.push("\targs := []rt.Value{}");
  for (const arg of cmd.arguments) {
    const name = goParam(arg.name);
    if (arg.variadic || arg.required) lines.push(`\targs = append(args, ${name})`);
    else lines.push(`\tif ${name} != nil {\n\t\targs = append(args, *${name})\n\t} else {\n\t\targs = append(args, nil)\n\t}`);
  }
  lines.push("\topts := rt.NewObject()");
  for (const opt of [...cmd.options].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    const field = `options.${goExported(opt.key)}`;
    lines.push(
      opt.type === "strings"
        ? `\tif ${field} != nil {\n\t\topts.Set(${goString(opt.key)}, ${field})\n\t}`
        : `\tif ${field} != nil {\n\t\topts.Set(${goString(opt.key)}, *${field})\n\t}`,
    );
  }
  lines.push(`\th.record(${goString(cmd.id)}, args, opts, parentOpts)`);
  const code = cmd.id === FAILING_COMMAND.id ? FAILING_COMMAND.exitCode : 0;
  if (cmd.llm) {
    const first = cmd.arguments[0];
    const firstText = !first ? '"undefined"' : first.variadic ? `strings.Join(${goParam(first.name)}, ",")` : first.required ? goParam(first.name) : `deref(${goParam(first.name)})`;
    lines.push(`\tprompt := ${goString(PROMPT_PREFIX)} + ${firstText}`);
    lines.push(`\treturn ${code}, &prompt`);
  } else {
    lines.push(`\treturn ${code}`);
  }
  lines.push("}");
  return lines.join("\n");
}

function mainSource(c: ConformanceContract): string {
  const cases = c.argv.map((argv) => `\t{${argv.map(goString).join(", ")}},`).join("\n");
  return `package main

import (
	"bytes"
	"fmt"
	"os"
	"sort"
	"strings"

	"conformance/${c.name}/gen"

	rt ${goString("github.com/foo-log-inc/cli-contracts/go/cli_contracts_runtime")}
)

var _ = strings.Join

type handlers struct {
	stdout *bytes.Buffer
}

func sorted(o *rt.Object) *rt.Object {
	keys := o.Keys()
	sort.Strings(keys)
	out := rt.NewObject()
	for _, k := range keys {
		v, _ := o.Get(k)
		out.Set(k, v)
	}
	return out
}

func deref(s *string) string {
	if s == nil {
		return "undefined"
	}
	return *s
}

var _ = deref

func (h *handlers) record(id string, args []rt.Value, opts, parentOpts *rt.Object) {
	line := rt.Obj("command", id, "args", args, "opts", opts, "globals", sorted(parentOpts))
	h.stdout.WriteString(${goString(HANDLER_PREFIX)} + rt.Stringify(line, 0) + "\\n")
}

${c.spec.commands.map(handlerMethod).join("\n\n")}

var cases = [][]string{
${cases}
}

func main() {
	h := &handlers{}
	var stderr *bytes.Buffer
	usage := rt.ProgramOptions{OnUsageError: func(err rt.UsageError, command *rt.Command) int {
		line := rt.Obj("code", err.Code, "exitCode", err.ExitCode, "message", err.Message, "command", command.Name)
		stderr.WriteString(${goString(USAGE_PREFIX)} + rt.Stringify(line, 0) + "\\n")
		return 2
	}}
	results := rt.NewObject()
	for _, variant := range []string{"plain", "usage"} {
		options := rt.ProgramOptions{}
		if variant == "usage" {
			options = usage
		}
		outcomes := []rt.Value{}
		for _, argv := range cases {
			var stdout bytes.Buffer
			stderr = &bytes.Buffer{}
			h.stdout = &stdout
			code := gen.NewProgram(h, ${goString(PROGRAM_VERSION)}, options).Run(argv, &stdout, stderr)
			outcomes = append(outcomes, rt.Obj("exitCode", code, "stdout", stdout.String(), "stderr", stderr.String()))
		}
		results.Set(variant, outcomes)
	}
	if err := os.WriteFile(os.Args[1], []byte(rt.Stringify(results, 0)), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
`;
}

export function prepareGo(contracts: ConformanceContract[], workDir: string): string {
  writeFileSync(
    join(workDir, "go.mod"),
    `module conformance\n\ngo 1.21\n\nrequire github.com/foo-log-inc/cli-contracts/go v0.0.0\n\nreplace github.com/foo-log-inc/cli-contracts/go => ${join(REPO, "go")}\n`,
  );
  const lines = [`cd ${JSON.stringify(workDir)}`];
  for (const c of contracts) {
    const dir = join(workDir, c.name);
    mkdirSync(join(dir, "gen"), { recursive: true });
    for (const [file, content] of Object.entries(generateGo(c.ctx, { package: "gen", contractYaml: c.yaml }))) {
      writeFileSync(join(dir, "gen", file), content);
    }
    writeFileSync(join(dir, "main.go"), mainSource(c));
    lines.push(`test -z "$(gofmt -l ${c.name})" || { gofmt -l ${c.name}; echo "gofmt: generated code is not formatted"; exit 1; }`);
    lines.push(`go vet ./${c.name}/...`);
    lines.push(`go run ./${c.name} ${JSON.stringify(join(workDir, `${c.name}.json`))}`);
  }
  mkdirSync(join(workDir, "client"), { recursive: true });
  writeFileSync(join(workDir, "client", "main.go"), clientSource(contracts, workDir));
  lines.push("go vet ./client", "go run ./client");
  return lines.join("\n");
}

/** The command wrapper calls of CLIENT_CASES, writing their outcomes to client.json. */
function clientSource(contracts: ConformanceContract[], workDir: string): string {
  const imports = contracts.map((c) => `\t${c.name} "conformance/${c.name}/gen"`);
  const calls: string[] = [];
  for (const k of CLIENT_CASES) {
    const c = contracts.find((x) => x.file === k.contract)!;
    const model = buildTypeModel(c.ctx);
    const cmd = model.commands.find((x) => x.id === k.command)!;
    const params = [goString(ARGV_SCRIPT)];
    if (cmd.arguments.length > 0) {
      const fields = cmd.arguments
        .filter((a) => k.args?.[a.name] !== undefined)
        .map((a) => `${goExported(a.name)}: ${goLiteral(k.args![a.name], a.type, a.optional && !a.variadic, model, c.name)}`);
      params.push(`${c.name}.${goExported(cmd.id)}Args{${fields.join(", ")}}`);
    }
    if (cmd.options.length > 0) {
      if (k.options === undefined) {
        params.push("nil");
      } else {
        const fields = cmd.options
          .filter((o) => k.options![o.name] !== undefined)
          .map((o) => `${goExported(o.name)}: ${goLiteral(k.options![o.name], o.type, true, model, c.name)}`);
        params.push(`&${c.name}.${goExported(cmd.id)}Options{${fields.join(", ")}}`);
      }
    }
    calls.push(`\tadd(${c.name}.${goExported(cmd.fullId)}(${params.join(", ")}))`);
  }
  return `package main

import (
	"os"

${imports.join("\n")}

	rt ${goString("github.com/foo-log-inc/cli-contracts/go/cli_contracts_runtime")}
)

func ptr[T any](v T) *T { return &v }

func main() {
	results := []rt.Value{}
	add := func(r rt.ExecResult) {
		results = append(results, rt.Obj("exitCode", r.ExitCode, "stdout", r.Stdout, "stderr", r.Stderr))
	}
${calls.join("\n")}
	if err := os.WriteFile(${goString(join(workDir, "client.json"))}, []byte(rt.Stringify(results, 0)), 0o644); err != nil {
		panic(err)
	}
}
`;
}
