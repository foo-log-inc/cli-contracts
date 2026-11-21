<?php

declare(strict_types=1);

namespace CliContracts\Runtime;

/**
 * The policy derivation of --introspect. The derivation is defined by
 * cli-contracts src/policy-runtime.ts (introspectCommand, derivePolicy,
 * isOptionActive); this is its port, and test/conformance compares the two.
 * A definition is the command's CommandPolicyDefinition as JSON (objects are
 * JsonObject).
 */
final class Policy
{
    private const RISK_ORDER = ['low' => 0, 'medium' => 1, 'high' => 2, 'critical' => 3];

    /** Whether a JSON object has the key. */
    private static function has(mixed $v, string $key): bool
    {
        return $v instanceof JsonObject && $v->has($key);
    }

    private static function get(mixed $v, string $key): mixed
    {
        return $v instanceof JsonObject ? $v->get($key) : null;
    }

    /** JavaScript's truthiness of a JSON value. */
    private static function truthy(mixed $v): bool
    {
        if ($v === null || $v === false || $v === '') {
            return false;
        }
        if ($v instanceof JsonNumber) {
            return !in_array($v->text, ['0', '-0', 'NaN'], true);
        }
        return true;
    }

    private static function riskLevel(mixed $effects): mixed
    {
        return self::get($effects, 'risk_level') ?? 'low';
    }

    private static function risk(mixed $level): ?int
    {
        return is_string($level) ? (self::RISK_ORDER[$level] ?? null) : null;
    }

    /** The source's explicit requires_confirmation, or else its own risk level at high or above. */
    private static function sourceRequiresConfirmation(mixed $effects): bool
    {
        $explicit = self::get($effects, 'requires_confirmation');
        if ($explicit !== null) {
            return self::truthy($explicit);
        }
        $n = self::risk(self::riskLevel($effects));
        return $n !== null && $n >= self::RISK_ORDER['high'];
    }

    /** Joins the -separated words of a name in camelCase, as commander keys an option's value. */
    public static function camelCase(string $name): string
    {
        $words = explode('-', $name);
        $out = array_shift($words);
        foreach ($words as $w) {
            $out .= mb_strtoupper(mb_substr($w, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($w, 1, null, 'UTF-8');
        }
        return $out;
    }

    private static function isOptionActive(mixed $definition, mixed $value, bool $specified): bool
    {
        if (self::get(self::get($definition, 'schema'), 'type') === 'boolean') {
            return $value === true;
        }
        if (self::truthy(self::get($definition, 'repeatable'))) {
            return $specified && is_array($value) && $value !== [];
        }
        return $specified && $value !== null;
    }

    private static function copy(JsonObject $out, string $key, mixed $from): void
    {
        if (self::has($from, $key)) {
            $out->set($key, self::get($from, $key));
        }
    }

    private static function copyIfTruthy(JsonObject $out, string $key, mixed $from): void
    {
        if (self::truthy(self::get($from, $key))) {
            $out->set($key, self::get($from, $key));
        }
    }

    private static function asTarget(mixed $v): mixed
    {
        return is_string($v) ? new JsonObject(['target' => $v]) : $v;
    }

    private static function semanticRead(mixed $r, string $source): JsonObject
    {
        $read = self::asTarget($r);
        $out = new JsonObject(['kind' => 'semantic']);
        self::copy($out, 'target', $read);
        self::copy($out, 'description', $read);
        $out->set('source', $source);
        return $out;
    }

    private static function semanticWrite(mixed $w, string $source): JsonObject
    {
        $write = self::asTarget($w);
        $out = new JsonObject(['kind' => 'semantic']);
        foreach (['target', 'description', 'overwrite', 'destructive', 'idempotent'] as $key) {
            self::copy($out, $key, $write);
        }
        self::copyIfTruthy($out, 'idempotency_key', $write);
        self::copyIfTruthy($out, 'idempotent_note', $write);
        $out->set('source', $source);
        return $out;
    }

    private static function networkEffect(mixed $network, string $source): JsonObject
    {
        $out = new JsonObject();
        self::copyIfTruthy($out, 'description', $network);
        self::copyIfTruthy($out, 'domains', $network);
        self::copy($out, 'idempotent', $network);
        self::copyIfTruthy($out, 'idempotency_key', $network);
        self::copyIfTruthy($out, 'idempotent_note', $network);
        $out->set('source', $source);
        return $out;
    }

    /**
     * Adds what one source of effects (the command, or an active option) declares.
     *
     * @param array<string, mixed> $d
     */
    private static function addEffects(array &$d, mixed $effects, string $source, bool $isCommand): void
    {
        $d['riskLevels'][] = self::riskLevel($effects);
        if (self::sourceRequiresConfirmation($effects)) {
            $d['confirmation'] = true;
        }
        $writes = self::get($effects, 'writes');
        if (self::truthy($writes) && is_array($writes)) {
            foreach ($writes as $w) {
                self::addWrite($d, self::semanticWrite($w, $source));
            }
        }
        $reads = self::get($effects, 'reads');
        if (self::truthy($reads) && is_array($reads)) {
            foreach ($reads as $r) {
                $d['reads'][] = self::semanticRead($r, $source);
            }
        }
        $network = self::get($effects, 'network');
        if (self::truthy($network)) {
            self::addSideEffect($d, 'network');
            if ($network instanceof JsonObject) {
                $d['network'][] = self::networkEffect($network, $source);
            }
        }
        $mode = self::get($effects, 'execution_mode');
        if (self::truthy($mode) && ($isCommand || $d['executionMode'] === null)) {
            $d['executionMode'] = $mode;
        }
    }

    /** @param array<string, mixed> $d */
    private static function addSideEffect(array &$d, string $effect): void
    {
        if (!in_array($effect, $d['sideEffects'], true)) {
            $d['sideEffects'][] = $effect;
        }
    }

    /**
     * Every derived write, and only a write, puts file_write among the side effects.
     *
     * @param array<string, mixed> $d
     */
    private static function addWrite(array &$d, JsonObject $write): void
    {
        self::addSideEffect($d, 'file_write');
        $d['writes'][] = $write;
    }

    /** @param array<string, array{definition: mixed, value: mixed, specified: bool}> $options */
    private static function derivePolicy(string $commandId, mixed $definition, array $options): JsonObject
    {
        $d = [
            'sideEffects' => [],
            'reads' => [],
            'writes' => [],
            'network' => [],
            'riskLevels' => [],
            'executionMode' => null,
            'confirmation' => false,
        ];
        $effects = self::get($definition, 'effects');
        if (self::truthy($effects)) {
            self::addEffects($d, $effects, "command:{$commandId}", true);
        }

        foreach ($options as $name => $input) {
            $name = (string) $name;
            if (!self::isOptionActive($input['definition'], $input['value'], $input['specified'])) {
                continue;
            }
            $source = "option:{$name}";
            $file = self::get($input['definition'], 'file');
            if (self::truthy($file)) {
                $value = $input['value'];
                $mode = self::get($file, 'mode');
                if ($mode === 'read' || $mode === 'readWrite') {
                    $read = new JsonObject(['kind' => 'option-file', 'option' => $name]);
                    if (is_string($value)) {
                        $read->set('path', $value);
                    }
                    $read->set('source', $source);
                    $d['reads'][] = $read;
                }
                if ($mode === 'write' || $mode === 'append' || $mode === 'readWrite') {
                    $write = new JsonObject(['kind' => 'option-file', 'option' => $name]);
                    if (is_string($value)) {
                        $write->set('path', $value);
                    }
                    $write->set('mode', $mode);
                    $write->set('source', $source);
                    self::addWrite($d, $write);
                }
            }
            $optionEffects = self::get($input['definition'], 'effects');
            if (self::truthy($optionEffects)) {
                self::addEffects($d, $optionEffects, $source, false);
            }
        }

        $finalRisk = 'low';
        $maxOrder = 0;
        foreach ($d['riskLevels'] as $level) {
            $n = self::risk($level);
            if ($n !== null && $n > $maxOrder) {
                $maxOrder = $n;
                $finalRisk = $level;
            }
        }

        $secrets = [];
        $env = self::get($definition, 'env');
        if ($env instanceof JsonObject) {
            foreach ($env->entries as $envName => $var) {
                if (self::truthy(self::get($var, 'sensitive'))) {
                    $secrets[] = (string) $envName;
                }
            }
        }

        $idempotent = true;
        foreach ($d['writes'] as $w) {
            if ($w->get('kind') === 'semantic' && $w->get('idempotent') !== true) {
                $idempotent = false;
            }
        }
        foreach ($d['network'] as $n) {
            if ($n->get('idempotent') !== true) {
                $idempotent = false;
            }
        }

        $policy = new JsonObject([
            'risk_level' => $finalRisk,
            'requires_confirmation' => $d['confirmation'],
            'idempotent' => $idempotent,
            'side_effects' => $d['sideEffects'],
            'reads' => $d['reads'],
            'writes' => $d['writes'],
        ]);
        if ($d['network'] !== []) {
            $policy->set('network', $d['network']);
        }
        if ($d['executionMode'] !== null) {
            $policy->set('execution_mode', $d['executionMode']);
        }
        if ($secrets !== []) {
            $policy->set('requires_secrets', $secrets);
        }
        return $policy;
    }

    /**
     * Derives a command's policy from the option values the program parsed
     * for it (introspectCommand).
     *
     * @param array<string, mixed> $optionValues
     */
    public static function introspect(string $commandId, mixed $definition, array $optionValues): JsonObject
    {
        $options = [];
        $active = [];
        $defs = self::get($definition, 'options');
        foreach (is_array($defs) ? $defs : [] as $opt) {
            $name = self::get($opt, 'name');
            $name = is_string($name) ? $name : '';
            $key = self::camelCase($name);
            $specified = array_key_exists($key, $optionValues) && $optionValues[$key] !== null;
            $value = $optionValues[$key] ?? null;
            $options[$name] = ['definition' => $opt, 'value' => $value, 'specified' => $specified];
            if (self::isOptionActive($opt, $value, $specified)) {
                $active[] = $name;
            }
        }
        return new JsonObject([
            'command' => $commandId,
            'active_options' => $active,
            'policy' => self::derivePolicy($commandId, $definition, $options),
        ]);
    }
}
