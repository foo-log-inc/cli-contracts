<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** @internal An exit, with its code, before the invocation reaches its end. */
final class ExitNow extends \RuntimeException
{
    public function __construct(public readonly int $exitCode)
    {
        parent::__construct('exit ' . $exitCode);
    }
}
