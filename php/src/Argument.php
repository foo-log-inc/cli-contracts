<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

final class Argument
{
    public function __construct(
        public readonly string $name,
        public readonly bool $required = false,
        public readonly bool $variadic = false,
    ) {
    }
}
