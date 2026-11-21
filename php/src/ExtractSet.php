<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** A command set of the embedded contract. */
final class ExtractSet
{
    /**
     * @param list<string> $before the set's entries before "commands"
     * @param list<string> $after the set's entries after "commands"
     * @param list<array{string, string}> $commands each command's ID and its JSON at its depth
     */
    public function __construct(
        public readonly string $id,
        public readonly string $key,
        public readonly array $before = [],
        public readonly array $after = [],
        public readonly array $commands = [],
    ) {
    }
}
