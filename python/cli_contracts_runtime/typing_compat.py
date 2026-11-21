"""``NotRequired`` for the TypedDicts of generated types. Python 3.11 has it
in ``typing``; before it, a key it marks is typed as required."""

from __future__ import annotations

from typing import Any

try:
    from typing import NotRequired  # type: ignore[attr-defined]
except ImportError:  # Python < 3.11

    class _NotRequired:
        def __getitem__(self, item: Any) -> Any:
            return item

    NotRequired = _NotRequired()  # type: ignore[assignment]

__all__ = ["NotRequired"]
