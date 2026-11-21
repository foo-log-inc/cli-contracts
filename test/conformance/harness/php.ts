// The PHP conformance programs: the generated classes, a handler that writes
// what it receives, and a main that runs every invocation in one process.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePhp, phpHandlerSignature, phpLiteral, phpMethod, phpString, phpVariable } from "../../../src/generators/php.js";
import { buildTypeModel } from "../../../src/generators/type-model.js";
import { toPascalCase } from "../../../src/generators/typescript.js";
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

function namespaceOf(c: ConformanceContract): string {
  return `Conformance\\${c.name.charAt(0).toUpperCase()}${c.name.slice(1)}`;
}

function handlerMethod(cmd: SpecCommand): string {
  const args = cmd.arguments.map((arg) => `$${phpVariable(arg.name)}`);
  const lines = [`    ${phpHandlerSignature(cmd)}`, "    {"];
  lines.push(`        $this->record(${phpString(cmd.id)}, [${args.join(", ")}], $options, $parentOpts);`);
  const code = cmd.id === FAILING_COMMAND.id ? FAILING_COMMAND.exitCode : 0;
  if (cmd.llm) {
    const first = cmd.arguments[0];
    const text = !first ? '"undefined"' : first.variadic ? `implode(",", ${args[0]})` : first.required ? args[0] : `(${args[0]} ?? "undefined")`;
    lines.push(`        return [${code}, ${phpString(PROMPT_PREFIX)} . ${text}];`);
  } else {
    lines.push(`        return ${code};`);
  }
  lines.push("    }");
  return lines.join("\n");
}

function mainSource(c: ConformanceContract, workDir: string): string {
  const ns = namespaceOf(c);
  const commands = [...new Map(c.spec.commands.map((cmd) => [cmd.id, cmd])).values()];
  const cases = c.argv.map((argv) => `    [${argv.map(phpString).join(", ")}],`).join("\n");
  return `<?php

declare(strict_types=1);

namespace ${ns}\\Harness;

use CliContracts\\Runtime as Rt;
use ${ns}\\CommandHandlers;
use ${ns}\\Program;

spl_autoload_register(static function (string $class): void {
    $roots = [
        'CliContracts\\\\Runtime\\\\' => ${phpString(join(REPO, "php/src"))},
        ${phpString(`${ns}\\`)} => ${phpString(join(workDir, c.name))},
    ];
    foreach ($roots as $prefix => $dir) {
        if (str_starts_with($class, $prefix)) {
            require $dir . '/' . str_replace('\\\\', '/', substr($class, strlen($prefix))) . '.php';
        }
    }
});

function sorted(array $o): Rt\\JsonObject
{
    ksort($o, SORT_STRING);
    return new Rt\\JsonObject($o);
}

final class Handlers implements CommandHandlers
{
    /** @var resource */
    public $stdout;

    private function record(string $id, array $args, array $opts, array $parentOpts): void
    {
        $line = new Rt\\JsonObject(['command' => $id, 'args' => $args, 'opts' => sorted($opts), 'globals' => sorted($parentOpts)]);
        fwrite($this->stdout, ${phpString(HANDLER_PREFIX)} . Rt\\Json::stringify($line) . "\\n");
    }

${commands.map(handlerMethod).join("\n\n")}
}

$resultsFile = $argv[1];
$cases = [
${cases}
];

$results = new Rt\\JsonObject();
foreach (['plain', 'usage'] as $variant) {
    $handlers = new Handlers();
    $stderr = null;
    $onUsageError = static function (Rt\\UsageError $err, Rt\\Command $command) use (&$stderr): int {
        $line = new Rt\\JsonObject(['code' => $err->code, 'exitCode' => $err->exitCode, 'message' => $err->message, 'command' => $command->name]);
        fwrite($stderr, ${phpString(USAGE_PREFIX)} . Rt\\Json::stringify($line) . "\\n");
        return 2;
    };
    $program = Program::create($handlers, ${phpString(PROGRAM_VERSION)}, $variant === 'usage' ? $onUsageError : null);
    $outcomes = [];
    foreach ($cases as $case) {
        $stdout = fopen('php://memory', 'w+');
        $stderr = fopen('php://memory', 'w+');
        $handlers->stdout = $stdout;
        $code = $program->run($case, $stdout, $stderr);
        rewind($stdout);
        rewind($stderr);
        $outcomes[] = new Rt\\JsonObject(['exitCode' => $code, 'stdout' => stream_get_contents($stdout), 'stderr' => stream_get_contents($stderr)]);
    }
    $results->set($variant, $outcomes);
}
file_put_contents($resultsFile, Rt\\Json::stringify($results));
`;
}

export function preparePhp(contracts: ConformanceContract[], workDir: string): string {
  const lines = [`cd ${JSON.stringify(workDir)}`];
  const files: string[] = [];
  for (const c of contracts) {
    const dir = join(workDir, c.name);
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(generatePhp(c.ctx, { namespace: namespaceOf(c), contractYaml: c.yaml }))) {
      writeFileSync(join(dir, file), content);
      files.push(join(c.name, file));
    }
    writeFileSync(join(workDir, `main_${c.name}.php`), mainSource(c, workDir));
    files.push(`main_${c.name}.php`);
  }
  writeFileSync(join(workDir, "client_main.php"), clientSource(contracts, workDir));
  files.push("client_main.php");
  lines.push(`for f in ${files.join(" ")}; do php -l "$f" >/dev/null || exit 1; done`);
  lines.push("php client_main.php");
  for (const c of contracts) {
    lines.push(`php main_${c.name}.php ${JSON.stringify(join(workDir, `${c.name}.json`))}`);
  }
  return lines.join("\n");
}

/** The command wrapper calls of CLIENT_CASES, writing their outcomes to client.json. */
function clientSource(contracts: ConformanceContract[], workDir: string): string {
  const roots = contracts.map((c) => `        ${phpString(`${namespaceOf(c)}\\`)} => ${phpString(join(workDir, c.name))},`);
  const calls: string[] = [];
  for (const k of CLIENT_CASES) {
    const c = contracts.find((x) => x.file === k.contract)!;
    const model = buildTypeModel(c.ctx);
    const cmd = model.commands.find((x) => x.id === k.command)!;
    const ns = `\\${namespaceOf(c)}`;
    const prefix = toPascalCase(cmd.id);
    const params = [phpString(ARGV_SCRIPT)];
    if (cmd.arguments.length > 0) {
      const named = cmd.arguments
        .filter((a) => k.args?.[a.name] !== undefined)
        .map((a) => `${phpVariable(a.name)}: ${phpLiteral(k.args![a.name], a.type, model)}`);
      params.push(`new ${ns}\\${prefix}Args(${named.join(", ")})`);
    }
    if (cmd.options.length > 0 && k.options !== undefined) {
      const named = cmd.options
        .filter((o) => k.options![o.name] !== undefined)
        .map((o) => `${phpVariable(o.name)}: ${phpLiteral(k.options![o.name], o.type, model)}`);
      params.push(`new ${ns}\\${prefix}Options(${named.join(", ")})`);
    }
    calls.push(`$add(${ns}\\Commands::${phpMethod(cmd.fullId)}(${params.join(", ")}));`);
  }
  return `<?php

declare(strict_types=1);

use CliContracts\\Runtime as Rt;

spl_autoload_register(static function (string $class): void {
    $roots = [
        'CliContracts\\\\Runtime\\\\' => ${phpString(join(REPO, "php/src"))},
${roots.join("\n")}
    ];
    foreach ($roots as $prefix => $dir) {
        if (str_starts_with($class, $prefix)) {
            require $dir . '/' . str_replace('\\\\', '/', substr($class, strlen($prefix))) . '.php';
        }
    }
});

$results = [];
$add = static function (Rt\\ExecResult $r) use (&$results): void {
    $results[] = new Rt\\JsonObject(['exitCode' => $r->exitCode, 'stdout' => $r->stdout, 'stderr' => $r->stderr]);
};
${calls.join("\n")}
file_put_contents(${phpString(join(workDir, "client.json"))}, Rt\\Json::stringify($results));
`;
}
