<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * A command of a generated program, as commander builds it for the contract
 * (cli-contracts src/generators/commander-tree.ts). The generator writes the
 * tree as a literal.
 */
final class Command
{
    public ?Command $parent = null;

    /**
     * @param list<Option> $options
     * @param array<string, mixed> $initialValues option values before parsing (the defaults)
     * @param list<Argument> $arguments
     * @param list<Command> $commands
     * @param list<string> $optionSuggestions the long flags an unknown option is compared with
     * @param list<string> $commandSuggestions the names an unknown command is compared with
     */
    public function __construct(
        public readonly string $name,
        public readonly string $help,
        public readonly array $options = [],
        public readonly array $initialValues = [],
        public readonly array $arguments = [],
        public readonly array $commands = [],
        public readonly bool $hidden = false,
        public readonly ?string $defaultCommand = null,
        public readonly ?string $helpCommand = null,
        public readonly ?string $helpShort = null,
        public readonly ?string $helpLong = null,
        public readonly ?Action $action = null,
        public readonly array $optionSuggestions = [],
        public readonly array $commandSuggestions = [],
        public readonly bool $digitShortOption = false,
    ) {
        foreach ($commands as $sub) {
            $sub->parent = $this;
        }
    }

    public function findCommand(?string $name): ?Command
    {
        if ($name === null || $name === '') {
            return null;
        }
        foreach ($this->commands as $sub) {
            if ($sub->name === $name) {
                return $sub;
            }
        }
        return null;
    }

    public function findOption(string $arg): ?Option
    {
        foreach ($this->options as $opt) {
            if (($opt->short !== null && $opt->short === $arg) || ($opt->long !== null && $opt->long === $arg)) {
                return $opt;
            }
        }
        return null;
    }

    public function isHelpFlag(string $arg): bool
    {
        return ($this->helpShort !== null && $arg === $this->helpShort)
            || ($this->helpLong !== null && $arg === $this->helpLong);
    }
}
