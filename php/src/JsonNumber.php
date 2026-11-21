<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** A JSON number, held as the text JavaScript writes for it. */
final class JsonNumber
{
    public function __construct(public readonly string $text)
    {
    }
}
