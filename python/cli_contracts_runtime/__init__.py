"""The runtime of the Python programs and command wrappers cli-contracts
generates from a CLI contract. A generated program holds its command tree
and dispatches to its handlers; this package parses an invocation over the
tree by commander's rules, so the program behaves as the TypeScript program
generated from the same contract."""

from .client import ExecResult, exec_cli, format_number
from .extract import ExtractSet, ExtractSpec
from .jsonvalue import Number, quote, stringify
from .policy import introspect
from .program import (
    FLAG,
    NEGATE,
    TAKES_VALUE,
    Action,
    Argument,
    Command,
    Invocation,
    Option,
    Outcome,
    Program,
    UsageError,
    outcome,
)

__version__ = "0.35.4"

__all__ = [
    "FLAG",
    "NEGATE",
    "TAKES_VALUE",
    "Action",
    "Argument",
    "Command",
    "ExecResult",
    "ExtractSet",
    "ExtractSpec",
    "Invocation",
    "Number",
    "Option",
    "Outcome",
    "Program",
    "UsageError",
    "exec_cli",
    "format_number",
    "introspect",
    "outcome",
    "quote",
    "stringify",
    "__version__",
]
