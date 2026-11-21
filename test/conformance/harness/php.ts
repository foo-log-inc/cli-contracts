// The PHP conformance programs: the generated classes, a handler that writes
// what it receives, and a main that runs every invocation in one process.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generatePhp, phpHandlerSignature, phpString, phpVariable } from "../../../src/generators/php.js";
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
  lines.push(`for f in ${files.join(" ")}; do php -l "$f" >/dev/null || exit 1; done`);
  for (const c of contracts) {
    lines.push(`php main_${c.name}.php ${JSON.stringify(join(workDir, `${c.name}.json`))}`);
  }
  return lines.join("\n");
}
