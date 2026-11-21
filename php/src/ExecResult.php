<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** The outcome of running a CLI. */
final class ExecResult
{
    public function __construct(
        public readonly int $exitCode,
        public readonly string $stdout,
        public readonly string $stderr,
    ) {
    }
}
