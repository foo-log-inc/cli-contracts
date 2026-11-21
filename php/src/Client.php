<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * The command wrappers' side: running a CLI with the arguments a wrapper
 * built, and writing a number as an argument the way the TypeScript
 * wrapper's String(value) does.
 */
final class Client
{
    /**
     * Runs an executable with arguments. A CLI that cannot be started, or is
     * ended by a signal, has exit code 1.
     *
     * @param list<string> $args
     */
    public static function exec(string $executable, array $args): ExecResult
    {
        $process = @proc_open([$executable, ...$args], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) {
            return new ExecResult(1, '', '');
        }
        $stdout = '';
        $stderr = '';
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        while (!feof($pipes[1]) || !feof($pipes[2])) {
            $read = array_filter([$pipes[1], $pipes[2]], static fn ($p): bool => !feof($p));
            $write = null;
            $except = null;
            if (stream_select($read, $write, $except, 1) === false) {
                break;
            }
            foreach ($read as $pipe) {
                $chunk = fread($pipe, 65536);
                if ($pipe === $pipes[1]) {
                    $stdout .= $chunk;
                } else {
                    $stderr .= $chunk;
                }
            }
        }
        fclose($pipes[1]);
        fclose($pipes[2]);
        $code = proc_close($process);
        return new ExecResult($code >= 0 ? $code : 1, $stdout, $stderr);
    }

    /**
     * Writes a value as an argument the way JavaScript's String(value) does: a
     * number in JavaScript's notation, a list as its items joined by commas
     * (null as nothing), an object as "[object Object]".
     */
    public static function argString(mixed $value): string
    {
        return match (true) {
            $value === null => 'null',
            $value === true => 'true',
            $value === false => 'false',
            is_int($value) => (string) $value,
            is_float($value) => self::formatNumber($value),
            is_string($value) => $value,
            $value instanceof JsonNumber => $value->text,
            is_array($value) && array_is_list($value) => implode(',', array_map(
                static fn (mixed $item): string => $item === null ? '' : self::argString($item),
                $value,
            )),
            default => '[object Object]',
        };
    }

    /**
     * Writes a number as JavaScript's String(n) does (Number::toString: the
     * shortest digits that read back as the number, in fixed notation from
     * 1e-7 up to 1e21 and exponential notation outside).
     */
    public static function formatNumber(float $f): string
    {
        if (is_nan($f)) {
            return 'NaN';
        }
        if (is_infinite($f)) {
            return $f > 0 ? 'Infinity' : '-Infinity';
        }
        if ($f == 0.0) {
            return '0';
        }
        $sign = $f < 0 ? '-' : '';
        // %.17e is enough digits to read back; the shortest is taken from them.
        $digits = '';
        $exp = 0;
        for ($precision = 0; $precision <= 16; $precision++) {
            $text = sprintf('%.' . $precision . 'e', abs($f));
            if ((float) $text === abs($f)) {
                [$mantissa, $e] = explode('e', $text);
                $digits = rtrim(str_replace('.', '', $mantissa), '0');
                $exp = (int) $e;
                break;
            }
        }
        $k = strlen($digits);
        $n = $exp + 1;
        if ($k <= $n && $n <= 21) {
            $out = $digits . str_repeat('0', $n - $k);
        } elseif (0 < $n && $n <= 21) {
            $out = substr($digits, 0, $n) . '.' . substr($digits, $n);
        } elseif (-6 < $n && $n <= 0) {
            $out = '0.' . str_repeat('0', -$n) . $digits;
        } else {
            $m = $digits[0] . ($k > 1 ? '.' . substr($digits, 1) : '');
            $out = $m . 'e' . ($n - 1 < 0 ? '-' : '+') . abs($n - 1);
        }
        return $sign . $out;
    }
}
