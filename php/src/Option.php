<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** An option as commander registers it. */
final class Option
{
    public const FLAG = 'flag';
    public const NEGATE = 'negate';
    public const TAKES_VALUE = 'value';

    /**
     * @param string $name the long flag without its dashes; commander keys the option's events by it
     * @param string $key the key the value is kept under (dry-run -> dryRun)
     * @param string $kind FLAG sets true, NEGATE sets false, TAKES_VALUE takes the next argument
     * @param bool $variadic collects every value given into a list
     * @param bool $version the program's -V, --version
     */
    public function __construct(
        public readonly string $flags,
        public readonly string $name,
        public readonly string $key,
        public readonly string $kind = self::FLAG,
        public readonly ?string $short = null,
        public readonly ?string $long = null,
        public readonly bool $variadic = false,
        public readonly bool $version = false,
    ) {
    }
}
