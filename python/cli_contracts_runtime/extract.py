"""The built-in extract command.

Its output is computed when the program is generated (cli-contracts
``src/generators/runtime-spec.ts``, ExtractSpec); what depends on the
invocation is filled in here: the time, and which commands the given IDs
select.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

EXTRACTED_AT = "\x00cli-contracts:extractedAt\x00"
"""Stands where the time of the invocation goes in the output."""
_EXTRACTED_AT_JSON = "\\u0000cli-contracts:extractedAt\\u0000"


@dataclass
class ExtractSet:
    """A command set of the embedded contract; ``commands`` holds each command's ID and its JSON at its depth."""

    id: str
    key: str
    before: List[str] = field(default_factory=list)
    after: List[str] = field(default_factory=list)
    commands: List[Tuple[str, str]] = field(default_factory=list)


@dataclass
class ExtractSpec:
    yaml_with_meta: str
    yaml_without_meta: str
    json_with_meta: str
    json_without_meta: str
    filter_head: str
    filter_tail: str
    sets: List[ExtractSet] = field(default_factory=list)


def _iso_now() -> str:
    """The time as JavaScript's ``Date.prototype.toISOString`` writes it."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def _truthy(values: Dict[str, Any], key: str) -> bool:
    v = values.get(key)
    if v is None or v is False:
        return False
    if isinstance(v, str):
        return v != ""
    return True


def run_extract(spec: ExtractSpec, args: List[Any], opts: Dict[str, Any]) -> Tuple[int, str, str]:
    """Runs the built-in extract command: the exit code, stdout and stderr."""
    commands = list(args[0]) if args and isinstance(args[0], list) else []
    all_ = _truthy(opts, "all")
    if not commands and not all_:
        return 2, "", '{"code":"INVALID_ARGS","message":"Specify command IDs or use --all"}\n'
    fmt = opts.get("format") if _truthy(opts, "format") else "yaml"
    ids = [] if all_ else commands
    include_meta = _truthy(opts, "includeMeta")
    now = _iso_now()
    if not ids:
        if fmt == "json":
            text = spec.json_with_meta if include_meta else spec.json_without_meta
            return 0, text.replace(_EXTRACTED_AT_JSON, now), ""
        text = spec.yaml_with_meta if include_meta else spec.yaml_without_meta
        return 0, text.replace(EXTRACTED_AT, now), ""

    def selected(set_id: str, cmd_id: str) -> bool:
        return any(i == cmd_id or i == f"{set_id}.{cmd_id}" or cmd_id.startswith(i + ".") for i in ids)

    sets: List[str] = []
    for s in spec.sets:
        matched = [text for cmd_id, text in s.commands if selected(s.id, cmd_id)]
        if not matched:
            continue
        entries = list(s.before)
        entries.append('      "commands": {\n' + ",\n".join(matched) + "\n      }")
        entries.extend(s.after)
        sets.append(s.key + "{\n" + ",\n".join(entries) + "\n    }")
    command_sets = "{\n" + ",\n".join(sets) + "\n  }" if sets else "{}"
    return 0, spec.filter_head + command_sets + spec.filter_tail, ""
