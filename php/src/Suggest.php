<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * The "(Did you mean ...?)" of an unknown option or command, by the rules of
 * commander 14 (lib/suggestSimilar.js). Lengths and characters are
 * JavaScript's UTF-16 code units.
 */
final class Suggest
{
    private const MAX_DISTANCE = 3;

    /** @return list<int> */
    private static function units(string $s): array
    {
        $utf16 = mb_convert_encoding($s, 'UTF-16LE', 'UTF-8');
        return $utf16 === '' ? [] : array_values(unpack('v*', $utf16));
    }

    /**
     * @param list<int> $a
     * @param list<int> $b
     */
    private static function editDistance(array $a, array $b): int
    {
        $la = count($a);
        $lb = count($b);
        if (abs($la - $lb) > self::MAX_DISTANCE) {
            return max($la, $lb);
        }
        $d = [];
        for ($i = 0; $i <= $la; $i++) {
            $d[$i] = array_fill(0, $lb + 1, 0);
            $d[$i][0] = $i;
        }
        for ($j = 0; $j <= $lb; $j++) {
            $d[0][$j] = $j;
        }
        for ($j = 1; $j <= $lb; $j++) {
            for ($i = 1; $i <= $la; $i++) {
                $cost = $a[$i - 1] === $b[$j - 1] ? 0 : 1;
                $d[$i][$j] = min($d[$i - 1][$j] + 1, $d[$i][$j - 1] + 1, $d[$i - 1][$j - 1] + $cost);
                if ($i > 1 && $j > 1 && $a[$i - 1] === $b[$j - 2] && $a[$i - 2] === $b[$j - 1]) {
                    $d[$i][$j] = min($d[$i][$j], $d[$i - 2][$j - 2] + 1);
                }
            }
        }
        return $d[$la][$lb];
    }

    /**
     * The order of a character in the root collation String.prototype.localeCompare
     * uses, for the characters of option and command names: punctuation (_
     * before -), then digits, then letters alphabetically without regard to
     * case; any other character by its code point after them.
     *
     * @return array{int, bool}
     */
    private static function collationKey(int $c): array
    {
        return match (true) {
            $c === 0x5f => [1, false],
            $c === 0x2d => [2, false],
            $c >= 0x30 && $c <= 0x39 => [200 + $c - 0x30, false],
            $c >= 0x61 && $c <= 0x7a => [300 + $c - 0x61, false],
            $c >= 0x41 && $c <= 0x5a => [300 + $c - 0x41, true],
            $c < 0x80 => [3 + $c, false],
            default => [1000 + $c, false],
        };
    }

    /**
     * Compares as String.prototype.localeCompare does for the characters
     * collationKey orders: first without regard to case, then a lowercase
     * letter before its uppercase.
     */
    private static function localeCompare(string $a, string $b): int
    {
        $key = static fn (string $c): array => self::collationKey(mb_ord($c, 'UTF-8'));
        $ka = array_map($key, mb_str_split($a, 1, 'UTF-8'));
        $kb = array_map($key, mb_str_split($b, 1, 'UTF-8'));
        $n = min(count($ka), count($kb));
        for ($i = 0; $i < $n; $i++) {
            if ($ka[$i][0] !== $kb[$i][0]) {
                return $ka[$i][0] < $kb[$i][0] ? -1 : 1;
            }
        }
        if (count($ka) !== count($kb)) {
            return count($ka) < count($kb) ? -1 : 1;
        }
        for ($i = 0; $i < $n; $i++) {
            if ($ka[$i][1] !== $kb[$i][1]) {
                return $ka[$i][1] ? 1 : -1;
            }
        }
        return 0;
    }

    /** @param list<string> $candidates */
    public static function similar(string $word, array $candidates): string
    {
        if ($candidates === []) {
            return '';
        }
        $unique = array_values(array_unique($candidates));
        $searchingOptions = str_starts_with($word, '--');
        if ($searchingOptions) {
            $word = substr($word, 2);
            $unique = array_map(static fn (string $c): string => substr($c, 2), $unique);
        }
        $w = self::units($word);
        $similar = [];
        $bestDistance = self::MAX_DISTANCE;
        foreach ($unique as $candidate) {
            $c = self::units($candidate);
            if (count($c) <= 1) {
                continue;
            }
            $distance = self::editDistance($w, $c);
            $length = max(count($w), count($c));
            $similarity = ($length - $distance) / $length;
            if ($similarity > 0.4) {
                if ($distance < $bestDistance) {
                    $bestDistance = $distance;
                    $similar = [$candidate];
                } elseif ($distance === $bestDistance) {
                    $similar[] = $candidate;
                }
            }
        }
        usort($similar, [self::class, 'localeCompare']);
        if ($searchingOptions) {
            $similar = array_map(static fn (string $c): string => '--' . $c, $similar);
        }
        if (count($similar) > 1) {
            return "\n(Did you mean one of " . implode(', ', $similar) . '?)';
        }
        if (count($similar) === 1) {
            return "\n(Did you mean {$similar[0]}?)";
        }
        return '';
    }
}
