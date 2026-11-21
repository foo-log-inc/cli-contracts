<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * The built-in extract command. What depends on the invocation is filled in
 * here: the time, and which commands the given IDs select.
 */
final class Extract
{
    /** Stands where the time of the invocation goes in the output. */
    public const EXTRACTED_AT = "\0cli-contracts:extractedAt\0";
    private const EXTRACTED_AT_JSON = '\\u0000cli-contracts:extractedAt\\u0000';

    /** The time as JavaScript's Date.prototype.toISOString writes it. */
    private static function isoNow(): string
    {
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        return $now->format('Y-m-d\TH:i:s.v\Z');
    }

    /** @param array<string, mixed> $values */
    private static function truthy(array $values, string $key): bool
    {
        $v = $values[$key] ?? null;
        return !($v === null || $v === false || $v === '');
    }

    /**
     * Runs the built-in extract command: the exit code, stdout and stderr.
     *
     * @param list<mixed> $args
     * @param array<string, mixed> $opts
     * @return array{int, string, string}
     */
    public static function run(ExtractSpec $spec, array $args, array $opts): array
    {
        $commands = is_array($args[0] ?? null) ? $args[0] : [];
        $all = self::truthy($opts, 'all');
        if ($commands === [] && !$all) {
            return [2, '', '{"code":"INVALID_ARGS","message":"Specify command IDs or use --all"}' . "\n"];
        }
        $format = self::truthy($opts, 'format') ? $opts['format'] : 'yaml';
        $ids = $all ? [] : $commands;
        $includeMeta = self::truthy($opts, 'includeMeta');
        $now = self::isoNow();
        if ($ids === []) {
            if ($format === 'json') {
                $text = $includeMeta ? $spec->jsonWithMeta : $spec->jsonWithoutMeta;
                return [0, str_replace(self::EXTRACTED_AT_JSON, $now, $text), ''];
            }
            $text = $includeMeta ? $spec->yamlWithMeta : $spec->yamlWithoutMeta;
            return [0, str_replace(self::EXTRACTED_AT, $now, $text), ''];
        }

        $selected = static function (string $setId, string $cmdId) use ($ids): bool {
            foreach ($ids as $id) {
                if ($id === $cmdId || $id === "{$setId}.{$cmdId}" || str_starts_with($cmdId, $id . '.')) {
                    return true;
                }
            }
            return false;
        };
        $sets = [];
        foreach ($spec->sets as $set) {
            $matched = [];
            foreach ($set->commands as [$cmdId, $text]) {
                if ($selected($set->id, $cmdId)) {
                    $matched[] = $text;
                }
            }
            if ($matched === []) {
                continue;
            }
            $entries = [...$set->before, "      \"commands\": {\n" . implode(",\n", $matched) . "\n      }", ...$set->after];
            $sets[] = $set->key . "{\n" . implode(",\n", $entries) . "\n    }";
        }
        $commandSets = $sets === [] ? '{}' : "{\n" . implode(",\n", $sets) . "\n  }";
        return [0, $spec->filterHead . $commandSets . $spec->filterTail, ''];
    }
}
