<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** An invocation the program rejects. $code is commander's code for the error. */
final class UsageError
{
    public function __construct(
        public readonly string $code,
        public readonly string $message,
        public readonly int $exitCode = 1,
    ) {
    }
}
