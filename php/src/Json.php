<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * Writes JSON values as JSON.stringify does: null, bool, int, JsonNumber,
 * string, a list (a JSON array), a JsonObject or an associative array (a
 * JSON object).
 */
final class Json
{
    public static function stringify(mixed $value, int $indent = 0): string
    {
        $out = '';
        self::write($out, $value, $indent, 0);
        return $out;
    }

    /** A string as JSON.stringify writes it. */
    public static function quote(string $s): string
    {
        $out = '"';
        $length = strlen($s);
        for ($i = 0; $i < $length; $i++) {
            $c = $s[$i];
            $o = ord($c);
            $out .= match (true) {
                $c === '"' => '\\"',
                $c === '\\' => '\\\\',
                $c === "\x08" => '\\b',
                $c === "\f" => '\\f',
                $c === "\n" => '\\n',
                $c === "\r" => '\\r',
                $c === "\t" => '\\t',
                $o < 0x20 => sprintf('\\u%04x', $o),
                default => $c,
            };
        }
        return $out . '"';
    }

    private static function newline(string &$out, int $indent, int $depth): void
    {
        if ($indent > 0) {
            $out .= "\n" . str_repeat(' ', $indent * $depth);
        }
    }

    private static function write(string &$out, mixed $value, int $indent, int $depth): void
    {
        if ($value === null) {
            $out .= 'null';
        } elseif ($value === true) {
            $out .= 'true';
        } elseif ($value === false) {
            $out .= 'false';
        } elseif ($value instanceof JsonNumber) {
            $out .= $value->text;
        } elseif (is_int($value)) {
            $out .= (string) $value;
        } elseif (is_string($value)) {
            $out .= self::quote($value);
        } elseif (is_array($value) && array_is_list($value)) {
            if ($value === []) {
                $out .= '[]';
                return;
            }
            $out .= '[';
            foreach ($value as $i => $item) {
                if ($i > 0) {
                    $out .= ',';
                }
                self::newline($out, $indent, $depth + 1);
                self::write($out, $item, $indent, $depth + 1);
            }
            self::newline($out, $indent, $depth);
            $out .= ']';
        } elseif (is_array($value) || $value instanceof JsonObject) {
            $entries = $value instanceof JsonObject ? $value->entries : $value;
            if ($entries === []) {
                $out .= '{}';
                return;
            }
            $out .= '{';
            $first = true;
            foreach ($entries as $k => $v) {
                if (!$first) {
                    $out .= ',';
                }
                $first = false;
                self::newline($out, $indent, $depth + 1);
                $out .= self::quote((string) $k) . ($indent > 0 ? ': ' : ':');
                self::write($out, $v, $indent, $depth + 1);
            }
            self::newline($out, $indent, $depth);
            $out .= '}';
        } else {
            throw new \InvalidArgumentException('not a JSON value');
        }
    }
}
