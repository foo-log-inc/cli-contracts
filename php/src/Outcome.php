<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/** What a handler returns: the exit code, and the prompt an LLM command built. */
final class Outcome
{
    public function __construct(
        public readonly int $exitCode = 0,
        public readonly ?string $prompt = null,
    ) {
    }

    /**
     * The outcome of what a handler returned: null (exit 0), an exit code, a
     * prompt (exit 0; written with --show-prompt), or [exit code, prompt].
     */
    public static function of(mixed $result): self
    {
        return match (true) {
            $result === null => new self(),
            is_int($result) => new self($result),
            is_string($result) => new self(0, $result),
            is_array($result) && count($result) === 2 => new self((int) $result[0], $result[1]),
            default => throw new \InvalidArgumentException('a handler returns null, an exit code or a prompt'),
        };
    }
}
