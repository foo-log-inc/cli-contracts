<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** What a command runs: a contract command's handler, or the built-in extract command. */
final class Action
{
    public function __construct(
        public readonly ?string $commandId = null,
        public readonly bool $llm = false,
        public readonly bool $introspect = false,
        public readonly bool $extract = false,
    ) {
    }
}
