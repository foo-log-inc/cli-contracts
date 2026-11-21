<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * A generated program: the tree, the version --version writes, and what
 * --introspect and the built-in extract command write.
 *
 * An invocation is parsed by the rules of commander 14 (lib/command.js:
 * parseOptions, _parseCommand, _dispatchSubcommand, _dispatchHelpCommand,
 * _processArguments, addOption's value handling, optsWithGlobals, version,
 * _outputHelpIfRequested and the error messages), over the parts of
 * commander a generated program uses. The TypeScript program generated from
 * the same contract is commander itself; test/conformance compares the two.
 */
final class Program
{
    /** @var array<int, array<string, mixed>> option values by command (spl_object_id) */
    private array $values = [];
    /** @var array<int, array<string, true>> the keys of each command the invocation set */
    private array $given = [];
    /** @var resource */
    private $stdout;
    /** @var resource */
    private $stderr;

    /**
     * @param \Closure(string, Invocation): Outcome $dispatch runs a contract command
     * @param (\Closure(UsageError, Command): int)|null $onUsageError ends an invocation the program
     *     rejects: writes what the contract declares for invalid arguments and returns the exit
     *     code; without it, the program writes the error's message and exits 1
     * @param array<string, mixed> $policy the policy definitions by command id
     */
    public function __construct(
        public readonly Command $root,
        public readonly string $version,
        private readonly \Closure $dispatch,
        private readonly ?\Closure $onUsageError = null,
        private readonly array $policy = [],
        private readonly ?ExtractSpec $extract = null,
    ) {
    }

    /**
     * Parses an invocation, runs what it names and returns the exit code.
     *
     * @param list<string> $argv
     * @param resource|null $stdout
     * @param resource|null $stderr
     */
    public function run(array $argv, $stdout = null, $stderr = null): int
    {
        $this->stdout = $stdout ?? STDOUT;
        $this->stderr = $stderr ?? STDERR;
        $this->values = [];
        $this->given = [];
        $this->prepare($this->root);
        try {
            return $this->parseCommand($this->root, [], array_values($argv));
        } catch (ExitNow $e) {
            return $e->exitCode;
        }
    }

    /** Runs the program with the process's arguments and exits with its exit code. */
    public function main(): never
    {
        global $argv;
        exit($this->run(array_slice($argv ?? [], 1)));
    }

    private function prepare(Command $cmd): void
    {
        $this->values[spl_object_id($cmd)] = $cmd->initialValues;
        foreach ($cmd->commands as $sub) {
            $this->prepare($sub);
        }
    }

    private function out(string $text): void
    {
        fwrite($this->stdout, $text);
    }

    private function err(string $text): void
    {
        fwrite($this->stderr, $text);
    }

    private function help(Command $cmd, bool $isError): never
    {
        if ($isError) {
            $this->err($cmd->help);
            throw new ExitNow(1);
        }
        $this->out($cmd->help);
        throw new ExitNow(0);
    }

    private function error(Command $cmd, string $message, string $code): never
    {
        $error = new UsageError($code, $message, 1);
        if ($this->onUsageError !== null) {
            throw new ExitNow(($this->onUsageError)($error, $cmd));
        }
        $this->err($message . "\n");
        throw new ExitNow(1);
    }

    private static function maybeOption(string $arg): bool
    {
        return strlen($arg) > 1 && $arg[0] === '-';
    }

    private function negativeNumberArg(Command $cmd, string $arg): bool
    {
        return preg_match('/^-(\d+|\d*\.\d+)(e[+-]?\d+)?\z/', $arg) === 1 && !$cmd->digitShortOption;
    }

    /** The length of a string in UTF-16 code units, as JavaScript counts it. */
    private static function jsLength(string $s): int
    {
        return intdiv(strlen(mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2);
    }

    private function emitOption(Command $cmd, Option $opt, ?string $value): void
    {
        if ($opt->version) {
            $this->out($this->version . "\n");
            throw new ExitNow(0);
        }
        $id = spl_object_id($cmd);
        $givenBefore = isset($this->given[$id][$opt->key]);
        $this->given[$id][$opt->key] = true;
        if ($value === null) {
            $this->values[$id][$opt->key] = $opt->kind !== Option::NEGATE;
        } elseif ($opt->variadic) {
            // A value given replaces the default and is added to the values given before it.
            $previous = $this->values[$id][$opt->key] ?? null;
            $this->values[$id][$opt->key] = $givenBefore && is_array($previous) ? [...$previous, $value] : [$value];
        } else {
            $this->values[$id][$opt->key] = $value;
        }
    }

    /**
     * @param list<string> $args
     * @return array{list<string>, list<string>}
     */
    private function parseOptions(Command $cmd, array $args): array
    {
        $operands = [];
        $unknown = [];
        $toUnknown = false;
        $activeVariadic = null;
        $activeGroup = null;
        $i = 0;
        $count = count($args);
        while ($i < $count || $activeGroup !== null) {
            if ($activeGroup !== null) {
                $arg = $activeGroup;
                $activeGroup = null;
            } else {
                $arg = $args[$i++];
            }

            if ($arg === '--') {
                if ($toUnknown) {
                    $unknown[] = $arg;
                    array_push($unknown, ...array_slice($args, $i));
                } else {
                    array_push($operands, ...array_slice($args, $i));
                }
                break;
            }

            if ($activeVariadic !== null && (!self::maybeOption($arg) || $this->negativeNumberArg($cmd, $arg))) {
                $this->emitOption($cmd, $activeVariadic, $arg);
                continue;
            }
            $activeVariadic = null;

            if (self::maybeOption($arg)) {
                $opt = $cmd->findOption($arg);
                if ($opt !== null) {
                    if ($opt->kind === Option::TAKES_VALUE) {
                        if ($i >= $count) {
                            $this->error($cmd, "error: option '{$opt->flags}' argument missing", 'commander.optionMissingArgument');
                        }
                        $this->emitOption($cmd, $opt, $args[$i++]);
                    } else {
                        $this->emitOption($cmd, $opt, null);
                    }
                    if ($opt->variadic) {
                        $activeVariadic = $opt;
                    }
                    continue;
                }
            }

            // Combined short options, like -abc: the first one if known. A
            // character outside the BMP is two code units in JavaScript, of
            // which arg[1] holds only the first; no flag matches it.
            if (self::jsLength($arg) > 2 && $arg[0] === '-' && $arg[1] !== '-') {
                $second = mb_substr(substr($arg, 1), 0, 1, 'UTF-8');
                if (mb_ord($second, 'UTF-8') < 0x10000) {
                    $opt = $cmd->findOption('-' . $second);
                    if ($opt !== null) {
                        $rest = substr($arg, 1 + strlen($second));
                        if ($opt->kind === Option::TAKES_VALUE) {
                            $this->emitOption($cmd, $opt, $rest);
                        } else {
                            $this->emitOption($cmd, $opt, null);
                            $activeGroup = '-' . $rest;
                        }
                        continue;
                    }
                }
            }

            // A known long option with its value, like --foo=bar.
            if (preg_match('/^--[^=]+=/', $arg) === 1) {
                $index = strpos($arg, '=');
                $opt = $cmd->findOption(substr($arg, 0, $index));
                if ($opt !== null && $opt->kind === Option::TAKES_VALUE) {
                    $this->emitOption($cmd, $opt, substr($arg, $index + 1));
                    continue;
                }
            }

            // An unknown option makes the arguments after it unknown too, so a
            // subcommand parses them again. A negative number in a leaf command
            // is not an option.
            if (!$toUnknown && self::maybeOption($arg)
                && !(count($cmd->commands) === 0 && $this->negativeNumberArg($cmd, $arg))) {
                $toUnknown = true;
            }
            if ($toUnknown) {
                $unknown[] = $arg;
            } else {
                $operands[] = $arg;
            }
        }
        return [$operands, $unknown];
    }

    /**
     * @param list<string> $operands
     * @param list<string> $unknown
     */
    private function parseCommand(Command $cmd, array $operands, array $unknown): int
    {
        [$parsedOperands, $parsedUnknown] = $this->parseOptions($cmd, $unknown);
        $operands = [...$operands, ...$parsedOperands];
        $unknown = $parsedUnknown;
        $args = [...$operands, ...$unknown];

        if ($operands !== [] && $cmd->findCommand($operands[0]) !== null) {
            return $this->dispatchSubcommand($cmd, $operands[0], array_slice($operands, 1), $unknown);
        }
        if ($cmd->helpCommand !== null && $operands !== [] && $operands[0] === $cmd->helpCommand) {
            return $this->dispatchHelpCommand($cmd, $operands[1] ?? '');
        }
        if ($cmd->defaultCommand !== null) {
            $this->outputHelpIfRequested($cmd, $unknown);
            return $this->dispatchSubcommand($cmd, $cmd->defaultCommand, $operands, $unknown);
        }
        if ($cmd->commands !== [] && $args === [] && $cmd->action === null) {
            $this->help($cmd, true);
        }

        $this->outputHelpIfRequested($cmd, $unknown);

        if ($cmd->action !== null) {
            $this->checkForUnknownOptions($cmd, $unknown);
            return $this->runAction($cmd, $this->processArguments($cmd, $args));
        }
        if ($operands !== []) {
            if ($cmd->commands !== []) {
                $this->unknownCommand($cmd, $args[0]);
            }
            $this->checkForUnknownOptions($cmd, $unknown);
            $this->processArguments($cmd, $args);
            return 0;
        }
        $this->checkForUnknownOptions($cmd, $unknown);
        if ($cmd->commands !== []) {
            $this->help($cmd, true);
        }
        $this->processArguments($cmd, $args);
        return 0;
    }

    /**
     * @param list<string> $operands
     * @param list<string> $unknown
     */
    private function dispatchSubcommand(Command $cmd, string $name, array $operands, array $unknown): int
    {
        $sub = $cmd->findCommand($name);
        if ($sub === null) {
            $this->help($cmd, true);
        }
        return $this->parseCommand($sub, $operands, $unknown);
    }

    private function dispatchHelpCommand(Command $cmd, string $name): int
    {
        if ($name === '') {
            $this->help($cmd, false);
        }
        $sub = $cmd->findCommand($name);
        if ($sub !== null) {
            $this->help($sub, false);
        }
        $flag = $cmd->helpLong ?? $cmd->helpShort ?? '--help';
        return $this->dispatchSubcommand($cmd, $name, [], [$flag]);
    }

    /** @param list<string> $args */
    private function outputHelpIfRequested(Command $cmd, array $args): void
    {
        foreach ($args as $arg) {
            if ($cmd->isHelpFlag($arg)) {
                $this->out($cmd->help);
                throw new ExitNow(0);
            }
        }
    }

    /** @param list<string> $unknown */
    private function checkForUnknownOptions(Command $cmd, array $unknown): void
    {
        if ($unknown !== []) {
            $flag = $unknown[0];
            $suggestion = str_starts_with($flag, '--') ? Suggest::similar($flag, $cmd->optionSuggestions) : '';
            $this->error($cmd, "error: unknown option '{$flag}'{$suggestion}", 'commander.unknownOption');
        }
    }

    private function unknownCommand(Command $cmd, string $name): never
    {
        $suggestion = Suggest::similar($name, $cmd->commandSuggestions);
        $this->error($cmd, "error: unknown command '{$name}'{$suggestion}", 'commander.unknownCommand');
    }

    /**
     * @param list<string> $args
     * @return list<mixed>
     */
    private function processArguments(Command $cmd, array $args): array
    {
        foreach ($cmd->arguments as $i => $arg) {
            if ($arg->required && $i >= count($args)) {
                $this->error($cmd, "error: missing required argument '{$arg->name}'", 'commander.missingArgument');
            }
        }
        $n = count($cmd->arguments);
        $lastVariadic = $n > 0 && $cmd->arguments[$n - 1]->variadic;
        if (!$lastVariadic && count($args) > $n) {
            $forSubcommand = $cmd->parent !== null ? " for '{$cmd->name}'" : '';
            $s = $n === 1 ? '' : 's';
            $received = count($args);
            $this->error(
                $cmd,
                "error: too many arguments{$forSubcommand}. Expected {$n} argument{$s} but got {$received}.",
                'commander.excessArguments',
            );
        }
        $processed = [];
        foreach ($cmd->arguments as $i => $arg) {
            $processed[] = $arg->variadic ? array_slice($args, $i) : ($args[$i] ?? null);
        }
        return $processed;
    }

    /** @return array<string, mixed> */
    private function optsWithGlobals(Command $cmd): array
    {
        $combined = [];
        for ($at = $cmd; $at !== null; $at = $at->parent) {
            foreach ($this->values[spl_object_id($at)] as $k => $v) {
                $combined[$k] = $v;
            }
        }
        return $combined;
    }

    /** JavaScript's truthiness of an option value. */
    private static function truthy(array $values, string $key): bool
    {
        if (!array_key_exists($key, $values)) {
            return false;
        }
        $v = $values[$key];
        return !($v === null || $v === false || $v === '');
    }

    /** @param list<mixed> $args */
    private function runAction(Command $cmd, array $args): int
    {
        $action = $cmd->action;
        $opts = $this->values[spl_object_id($cmd)];
        if ($action->extract) {
            [$code, $out, $err] = Extract::run($this->extract, $args, $opts);
            $this->out($out);
            $this->err($err);
            return $code;
        }
        $globals = $this->optsWithGlobals($cmd);
        if ($action->introspect && self::truthy($globals, 'introspect')) {
            $result = Policy::introspect($action->commandId, $this->policy[$action->commandId] ?? null, $globals);
            $this->out(Json::stringify($result, 2) . "\n");
            return 0;
        }
        $showPrompt = $action->llm && self::truthy($opts, 'showPrompt');
        $outcome = ($this->dispatch)($action->commandId, new Invocation($args, $opts, $globals));
        if ($showPrompt && $outcome->prompt !== null) {
            $this->out($outcome->prompt . "\n");
        }
        return $outcome->exitCode;
    }
}
