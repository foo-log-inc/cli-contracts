"""The command wrappers' side: running a CLI with the arguments a wrapper
built, and writing a number as an argument the way the TypeScript wrapper's
``String(value)`` does."""

from __future__ import annotations

import math
import subprocess
from decimal import Decimal
from dataclasses import dataclass
from typing import List


@dataclass
class ExecResult:
    exit_code: int
    stdout: str
    stderr: str


def exec_cli(executable: str, args: List[str]) -> ExecResult:
    """Runs an executable with arguments. A CLI that cannot be started, or is
    ended by a signal, has exit code 1."""
    try:
        done = subprocess.run([executable, *args], capture_output=True, check=False)
    except OSError:
        return ExecResult(exit_code=1, stdout="", stderr="")
    code = done.returncode if done.returncode >= 0 else 1
    return ExecResult(
        exit_code=code,
        stdout=done.stdout.decode("utf-8", "replace"),
        stderr=done.stderr.decode("utf-8", "replace"),
    )


def format_number(f: float) -> str:
    """Writes a number as JavaScript's ``String(n)`` does (Number::toString:
    the shortest digits that read back as the number, in fixed notation from
    1e-7 up to 1e21 and exponential notation outside)."""
    f = float(f)
    if math.isnan(f):
        return "NaN"
    if math.isinf(f):
        return "Infinity" if f > 0 else "-Infinity"
    if f == 0:
        return "0"
    sign = "-" if f < 0 else ""
    # repr writes the shortest digits that read back as the number.
    _, digit_tuple, exponent = Decimal(repr(abs(f))).as_tuple()
    digits = "".join(map(str, digit_tuple))
    stripped = digits.rstrip("0")
    exponent += len(digits) - len(stripped)
    digits = stripped.lstrip("0")
    k = len(digits)
    n = k + int(exponent)
    if k <= n <= 21:
        out = digits + "0" * (n - k)
    elif 0 < n <= 21:
        out = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        out = "0." + "0" * (-n) + digits
    else:
        m = digits[0] + ("." + digits[1:] if k > 1 else "")
        out = f"{m}e{'-' if n - 1 < 0 else '+'}{abs(n - 1)}"
    return sign + out


def arg_string(value: object) -> str:
    """Writes a value as an argument the way JavaScript's ``String(value)``
    does: a number in JavaScript's notation, a list as its items joined by
    commas (None as nothing), an object as ``[object Object]``."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return format_number(value)
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return ",".join("" if item is None else arg_string(item) for item in value)
    return "[object Object]"
