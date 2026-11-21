"""The policy derivation of ``--introspect``.

The derivation is defined by cli-contracts ``src/policy-runtime.ts``
(introspectCommand, derivePolicy, isOptionActive); this is its port, and
test/conformance compares the two. A definition is the command's
CommandPolicyDefinition as JSON.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .jsonvalue import Number

_RISK_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}
_ABSENT = object()


def _truthy(v: Any) -> bool:
    """JavaScript's truthiness of a JSON value; absent is falsy."""
    if v is _ABSENT or v is None or v is False:
        return False
    if isinstance(v, str):
        return v != ""
    if isinstance(v, Number):
        return v.text not in ("0", "-0", "NaN")
    return True


def _get(v: Any, key: str) -> Any:
    if isinstance(v, dict) and key in v:
        return v[key]
    return _ABSENT


def _risk_level(effects: Any) -> Any:
    level = _get(effects, "risk_level")
    return "low" if level is _ABSENT or level is None else level


def _risk(level: Any) -> Optional[int]:
    return _RISK_ORDER.get(level) if isinstance(level, str) else None


def _source_requires_confirmation(effects: Any) -> bool:
    """The source's explicit requires_confirmation, or else its own risk level at high or above."""
    explicit = _get(effects, "requires_confirmation")
    if explicit is not _ABSENT and explicit is not None:
        return _truthy(explicit)
    n = _risk(_risk_level(effects))
    return n is not None and n >= _RISK_ORDER["high"]


def camel_case(name: str) -> str:
    """Joins the ``-``-separated words of a name in camelCase, as commander keys an option's value."""
    words = name.split("-")
    return words[0] + "".join(w[:1].upper() + w[1:] for w in words[1:])


def _is_option_active(definition: Any, value: Any, specified: bool) -> bool:
    if _get(_get(definition, "schema"), "type") == "boolean":
        return value is True
    if _truthy(_get(definition, "repeatable")):
        return specified and isinstance(value, list) and len(value) > 0
    return specified and value is not None and value is not _ABSENT


def _copy(out: Dict[str, Any], key: str, src: Any) -> None:
    v = _get(src, key)
    if v is not _ABSENT:
        out[key] = v


def _copy_if_truthy(out: Dict[str, Any], key: str, src: Any) -> None:
    v = _get(src, key)
    if _truthy(v):
        out[key] = v


def _semantic_read(r: Any, source: str) -> Dict[str, Any]:
    read = {"target": r} if isinstance(r, str) else r
    out: Dict[str, Any] = {"kind": "semantic"}
    _copy(out, "target", read)
    _copy(out, "description", read)
    out["source"] = source
    return out


def _semantic_write(w: Any, source: str) -> Dict[str, Any]:
    write = {"target": w} if isinstance(w, str) else w
    out: Dict[str, Any] = {"kind": "semantic"}
    for key in ("target", "description", "overwrite", "destructive", "idempotent"):
        _copy(out, key, write)
    _copy_if_truthy(out, "idempotency_key", write)
    _copy_if_truthy(out, "idempotent_note", write)
    out["source"] = source
    return out


def _network_effect(network: Any, source: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    _copy_if_truthy(out, "description", network)
    _copy_if_truthy(out, "domains", network)
    _copy(out, "idempotent", network)
    _copy_if_truthy(out, "idempotency_key", network)
    _copy_if_truthy(out, "idempotent_note", network)
    out["source"] = source
    return out


class _Derivation:
    def __init__(self) -> None:
        self.side_effects: List[str] = []
        self.reads: List[Any] = []
        self.writes: List[Any] = []
        self.network: List[Any] = []
        self.risk_levels: List[Any] = []
        self.execution_mode: Any = None
        self.confirmation = False

    def add_side_effect(self, effect: str) -> None:
        if effect not in self.side_effects:
            self.side_effects.append(effect)

    def add_write(self, write: Dict[str, Any]) -> None:
        # Every derived write, and only a write, puts file_write among the side effects.
        self.add_side_effect("file_write")
        self.writes.append(write)

    def add_effects(self, effects: Any, source: str, is_command: bool) -> None:
        self.risk_levels.append(_risk_level(effects))
        if _source_requires_confirmation(effects):
            self.confirmation = True
        writes = _get(effects, "writes")
        if _truthy(writes) and isinstance(writes, list):
            for w in writes:
                self.add_write(_semantic_write(w, source))
        reads = _get(effects, "reads")
        if _truthy(reads) and isinstance(reads, list):
            for r in reads:
                self.reads.append(_semantic_read(r, source))
        network = _get(effects, "network")
        if _truthy(network):
            self.add_side_effect("network")
            if isinstance(network, dict):
                self.network.append(_network_effect(network, source))
        mode = _get(effects, "execution_mode")
        if _truthy(mode) and (is_command or self.execution_mode is None):
            self.execution_mode = mode


def _derive_policy(command_id: str, definition: Any, options: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    d = _Derivation()
    effects = _get(definition, "effects")
    if _truthy(effects):
        d.add_effects(effects, f"command:{command_id}", True)

    for name, inp in options.items():
        if not _is_option_active(inp["definition"], inp["value"], inp["specified"]):
            continue
        source = f"option:{name}"
        file = _get(inp["definition"], "file")
        if _truthy(file):
            value = inp["value"]
            mode = _get(file, "mode")
            if mode in ("read", "readWrite"):
                read: Dict[str, Any] = {"kind": "option-file", "option": name}
                if isinstance(value, str):
                    read["path"] = value
                read["source"] = source
                d.reads.append(read)
            if mode in ("write", "append", "readWrite"):
                write: Dict[str, Any] = {"kind": "option-file", "option": name}
                if isinstance(value, str):
                    write["path"] = value
                write["mode"] = mode
                write["source"] = source
                d.add_write(write)
        option_effects = _get(inp["definition"], "effects")
        if _truthy(option_effects):
            d.add_effects(option_effects, source, False)

    final_risk: Any = "low"
    max_order = 0
    for level in d.risk_levels:
        n = _risk(level)
        if n is not None and n > max_order:
            max_order = n
            final_risk = level

    secrets: List[str] = []
    env = _get(definition, "env")
    if isinstance(env, dict):
        for env_name, var in env.items():
            if _truthy(_get(var, "sensitive")):
                secrets.append(env_name)

    idempotent = all(w.get("idempotent") is True for w in d.writes if w.get("kind") == "semantic") and all(
        n.get("idempotent") is True for n in d.network
    )

    policy: Dict[str, Any] = {
        "risk_level": final_risk,
        "requires_confirmation": d.confirmation,
        "idempotent": idempotent,
        "side_effects": list(d.side_effects),
        "reads": d.reads,
        "writes": d.writes,
    }
    if d.network:
        policy["network"] = d.network
    if d.execution_mode is not None:
        policy["execution_mode"] = d.execution_mode
    if secrets:
        policy["requires_secrets"] = secrets
    return policy


def introspect(command_id: str, definition: Any, option_values: Dict[str, Any]) -> Dict[str, Any]:
    """Derives a command's policy from the option values the program parsed for it (introspectCommand)."""
    options: Dict[str, Dict[str, Any]] = {}
    active: List[str] = []
    defs = _get(definition, "options")
    for opt in defs if isinstance(defs, list) else []:
        name = _get(opt, "name")
        name = name if isinstance(name, str) else ""
        key = camel_case(name)
        value = option_values.get(key)
        specified = key in option_values and value is not None
        options[name] = {"definition": opt, "value": value, "specified": specified}
        if _is_option_active(opt, value, specified):
            active.append(name)
    return {
        "command": command_id,
        "active_options": active,
        "policy": _derive_policy(command_id, definition, options),
    }
