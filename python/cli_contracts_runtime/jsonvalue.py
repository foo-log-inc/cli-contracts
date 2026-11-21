"""JSON values and a writer that writes them as ``JSON.stringify`` does.

A JSON object is a ``dict`` (it keeps its keys in insertion order, as a
JavaScript object does); a number is a :class:`Number`, which holds the text
JavaScript writes for it.
"""

from __future__ import annotations

from typing import Any


class Number:
    """A JSON number, held as the text JavaScript writes for it."""

    __slots__ = ("text",)

    def __init__(self, text: str) -> None:
        self.text = text

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Number) and other.text == self.text

    def __hash__(self) -> int:
        return hash(self.text)

    def __repr__(self) -> str:
        return f"Number({self.text!r})"


_ESCAPES = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t"}


def quote(s: str) -> str:
    """A string as ``JSON.stringify`` writes it."""
    out = ['"']
    for c in s:
        escaped = _ESCAPES.get(c)
        if escaped is not None:
            out.append(escaped)
        elif ord(c) < 0x20:
            out.append("\\u%04x" % ord(c))
        else:
            out.append(c)
    out.append('"')
    return "".join(out)


def stringify(value: Any, indent: int = 0) -> str:
    """Writes a value as ``JSON.stringify(value, null, indent)`` does; an
    indent of 0 writes it on one line."""
    out: list[str] = []
    _write(out, value, indent, 0)
    return "".join(out)


def _newline(out: list[str], indent: int, depth: int) -> None:
    if indent > 0:
        out.append("\n" + " " * (indent * depth))


def _write(out: list[str], value: Any, indent: int, depth: int) -> None:
    if value is None:
        out.append("null")
    elif value is True:
        out.append("true")
    elif value is False:
        out.append("false")
    elif isinstance(value, Number):
        out.append(value.text)
    elif isinstance(value, int):
        out.append(str(value))
    elif isinstance(value, str):
        out.append(quote(value))
    elif isinstance(value, (list, tuple)):
        if not value:
            out.append("[]")
            return
        out.append("[")
        for i, item in enumerate(value):
            if i > 0:
                out.append(",")
            _newline(out, indent, depth + 1)
            _write(out, item, indent, depth + 1)
        _newline(out, indent, depth)
        out.append("]")
    elif isinstance(value, dict):
        if not value:
            out.append("{}")
            return
        out.append("{")
        for i, (k, v) in enumerate(value.items()):
            if i > 0:
                out.append(",")
            _newline(out, indent, depth + 1)
            out.append(quote(k))
            out.append(": " if indent > 0 else ":")
            _write(out, v, indent, depth + 1)
        _newline(out, indent, depth)
        out.append("}")
    else:
        raise TypeError(f"not a JSON value: {value!r}")
