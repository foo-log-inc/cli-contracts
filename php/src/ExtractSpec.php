<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * The output of the built-in extract command, computed when the program is
 * generated (cli-contracts src/generators/runtime-spec.ts, ExtractSpec).
 */
final class ExtractSpec
{
    /** @param list<ExtractSet> $sets */
    public function __construct(
        public readonly string $yamlWithMeta,
        public readonly string $yamlWithoutMeta,
        public readonly string $jsonWithMeta,
        public readonly string $jsonWithoutMeta,
        public readonly string $filterHead,
        public readonly string $filterTail,
        public readonly array $sets = [],
    ) {
    }
}
