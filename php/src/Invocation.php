<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * What a command's handler receives: the argument values (a string, null for
 * an optional argument not given, a list for a variadic one), the command's
 * own option values (commander's opts()) and those of the command and its
 * ancestors, an ancestor's value replacing the command's (optsWithGlobals()).
 */
final class Invocation
{
    /**
     * @param list<mixed> $args
     * @param array<string, mixed> $opts
     * @param array<string, mixed> $globals
     */
    public function __construct(
        public readonly array $args,
        public readonly array $opts,
        public readonly array $globals,
    ) {
    }
}
