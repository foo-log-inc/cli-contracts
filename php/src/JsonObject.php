<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * A JSON object that keeps its keys in insertion order, as a JavaScript
 * object does. (A PHP array stands for a JSON array.)
 */
final class JsonObject
{
    /** @param array<array-key, mixed> $entries */
    public function __construct(public array $entries = [])
    {
    }

    public function set(string $key, mixed $value): void
    {
        $this->entries[$key] = $value;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->entries);
    }

    public function get(string $key): mixed
    {
        return $this->entries[$key] ?? null;
    }
}
