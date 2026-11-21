"""The command tree of a generated program and the parsing of an invocation.

The tree is the one commander builds for the contract (cli-contracts
``src/generators/commander-tree.ts``); the generator writes it as a literal.
An invocation is parsed by the rules of commander 14 (lib/command.js:
parseOptions, _parseCommand, _dispatchSubcommand, _dispatchHelpCommand,
_processArguments, addOption's value handling, optsWithGlobals, version,
_outputHelpIfRequested and the error messages; lib/suggestSimilar.js), over
the parts of commander a generated program uses. The TypeScript program
generated from the same contract is commander itself; test/conformance
compares the two.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from typing import IO, Any, Callable, Dict, List, Optional, Tuple

from .jsonvalue import stringify
from .policy import introspect

FLAG = "flag"
NEGATE = "negate"
TAKES_VALUE = "value"


@dataclass
class Option:
    """An option as commander registers it."""

    flags: str
    name: str
    key: str
    kind: str = FLAG
    short: Optional[str] = None
    long: Optional[str] = None
    variadic: bool = False
    version: bool = False


@dataclass
class Argument:
    name: str
    required: bool = False
    variadic: bool = False


@dataclass
class Action:
    """What a command runs: a contract command's handler, or the built-in extract command."""

    command_id: Optional[str] = None
    llm: bool = False
    introspect: bool = False
    extract: bool = False


@dataclass
class Command:
    name: str
    help: str
    options: List[Option] = field(default_factory=list)
    initial_values: List[Tuple[str, Any]] = field(default_factory=list)
    arguments: List[Argument] = field(default_factory=list)
    commands: List["Command"] = field(default_factory=list)
    hidden: bool = False
    default_command: Optional[str] = None
    help_command: Optional[str] = None
    help_short: Optional[str] = None
    help_long: Optional[str] = None
    action: Optional[Action] = None
    option_suggestions: List[str] = field(default_factory=list)
    command_suggestions: List[str] = field(default_factory=list)
    digit_short_option: bool = False
    parent: Optional["Command"] = field(default=None, repr=False, compare=False)

    def _link(self) -> None:
        for sub in self.commands:
            sub.parent = self
            sub._link()

    def _find_command(self, name: Optional[str]) -> Optional["Command"]:
        if not name:
            return None
        for sub in self.commands:
            if sub.name == name:
                return sub
        return None

    def _find_option(self, arg: str) -> Optional[Option]:
        for opt in self.options:
            if (opt.short is not None and opt.short == arg) or (opt.long is not None and opt.long == arg):
                return opt
        return None

    def _is_help_flag(self, arg: str) -> bool:
        return (self.help_short is not None and arg == self.help_short) or (
            self.help_long is not None and arg == self.help_long
        )


@dataclass
class UsageError:
    """An invocation the program rejects. ``code`` is commander's code for the error."""

    code: str
    message: str
    exit_code: int = 1


@dataclass
class Invocation:
    """What a command's handler receives: the argument values (a string, None
    for an optional argument not given, a list for a variadic one), the
    command's own option values (commander's ``opts()``) and those of the
    command and its ancestors, an ancestor's value replacing the command's
    (``optsWithGlobals()``)."""

    args: List[Any]
    opts: Dict[str, Any]
    globals: Dict[str, Any]


@dataclass
class Outcome:
    exit_code: int = 0
    prompt: Optional[str] = None


Dispatch = Callable[[str, Invocation], Outcome]
UsageErrorHandler = Callable[[UsageError, Command], int]


class _Exit(Exception):
    def __init__(self, code: int) -> None:
        super().__init__(code)
        self.code = code


_NEGATIVE_NUMBER = re.compile(r"^-(\d+|\d*\.\d+)(e[+-]?\d+)?$", re.ASCII)
_LONG_WITH_VALUE = re.compile(r"^--[^=]+=")


def _maybe_option(arg: str) -> bool:
    return len(arg) > 1 and arg[0] == "-"


def _js_len(s: str) -> int:
    """The length of a string in UTF-16 code units, as JavaScript counts it."""
    return sum(2 if ord(c) >= 0x10000 else 1 for c in s)


def _truthy(values: Dict[str, Any], key: str) -> bool:
    """JavaScript's truthiness of an option value."""
    if key not in values:
        return False
    v = values[key]
    if v is None or v is False:
        return False
    if isinstance(v, str):
        return v != ""
    return True


class Program:
    """A generated program: the tree, the version ``--version`` writes, and
    what ``--introspect`` and the built-in extract command write."""

    def __init__(
        self,
        root: Command,
        version: str,
        dispatch: Dispatch,
        on_usage_error: Optional[UsageErrorHandler] = None,
        policy: Optional[Dict[str, Any]] = None,
        extract: Any = None,
    ) -> None:
        root._link()
        self.root = root
        self.version = version
        self.dispatch = dispatch
        self.on_usage_error = on_usage_error
        self.policy = policy or {}
        self.extract = extract

    def run(self, argv: List[str], stdout: Optional[IO[str]] = None, stderr: Optional[IO[str]] = None) -> int:
        """Parses an invocation, runs what it names and returns the exit code."""
        run = _Run(self, stdout or sys.stdout, stderr or sys.stderr)
        try:
            return run.parse_command(self.root, [], list(argv))
        except _Exit as e:
            return e.code

    def main(self) -> None:
        """Runs the program with the process's arguments and exits with its exit code."""
        sys.exit(self.run(sys.argv[1:]))


class _Run:
    def __init__(self, program: Program, stdout: IO[str], stderr: IO[str]) -> None:
        self.p = program
        self.stdout = stdout
        self.stderr = stderr
        self.values: Dict[int, Dict[str, Any]] = {}
        self._prepare(program.root)

    def _prepare(self, cmd: Command) -> None:
        self.values[id(cmd)] = {k: (list(v) if isinstance(v, list) else v) for k, v in cmd.initial_values}
        for sub in cmd.commands:
            self._prepare(sub)

    def help(self, cmd: Command, is_error: bool) -> None:
        if is_error:
            self.stderr.write(cmd.help)
            raise _Exit(1)
        self.stdout.write(cmd.help)
        raise _Exit(0)

    def error(self, cmd: Command, message: str, code: str) -> None:
        err = UsageError(code=code, message=message, exit_code=1)
        if self.p.on_usage_error is not None:
            raise _Exit(self.p.on_usage_error(err, cmd))
        self.stderr.write(message + "\n")
        raise _Exit(1)

    def negative_number_arg(self, cmd: Command, arg: str) -> bool:
        return _NEGATIVE_NUMBER.match(arg) is not None and not cmd.digit_short_option

    def emit_option(self, cmd: Command, opt: Option, value: Optional[str]) -> None:
        if opt.version:
            self.stdout.write(self.p.version + "\n")
            raise _Exit(0)
        values = self.values[id(cmd)]
        if value is None:
            values[opt.key] = opt.kind != NEGATE
        elif opt.variadic:
            previous = values.get(opt.key)
            if isinstance(previous, list):
                previous.append(value)
            else:
                values[opt.key] = [value]
        else:
            values[opt.key] = value

    def parse_options(self, cmd: Command, args: List[str]) -> Tuple[List[str], List[str]]:
        operands: List[str] = []
        unknown: List[str] = []
        to_unknown = False
        active_variadic: Optional[Option] = None
        active_group: Optional[str] = None
        i = 0
        while i < len(args) or active_group is not None:
            if active_group is not None:
                arg = active_group
                active_group = None
            else:
                arg = args[i]
                i += 1

            if arg == "--":
                dest = unknown if to_unknown else operands
                if to_unknown:
                    dest.append(arg)
                dest.extend(args[i:])
                break

            if active_variadic is not None and (not _maybe_option(arg) or self.negative_number_arg(cmd, arg)):
                self.emit_option(cmd, active_variadic, arg)
                continue
            active_variadic = None

            if _maybe_option(arg):
                opt = cmd._find_option(arg)
                if opt is not None:
                    if opt.kind == TAKES_VALUE:
                        if i >= len(args):
                            self.error(cmd, f"error: option '{opt.flags}' argument missing", "commander.optionMissingArgument")
                        value = args[i]
                        i += 1
                        self.emit_option(cmd, opt, value)
                    else:
                        self.emit_option(cmd, opt, None)
                    if opt.variadic:
                        active_variadic = opt
                    continue

            # Combined short options, like -abc: the first one if known. A
            # character outside the BMP is two code units in JavaScript, of
            # which arg[1] holds only the first; no flag matches it.
            if _js_len(arg) > 2 and arg[0] == "-" and arg[1] != "-" and ord(arg[1]) < 0x10000:
                opt = cmd._find_option("-" + arg[1])
                if opt is not None:
                    if opt.kind == TAKES_VALUE:
                        self.emit_option(cmd, opt, arg[2:])
                    else:
                        self.emit_option(cmd, opt, None)
                        active_group = "-" + arg[2:]
                    continue

            # A known long option with its value, like --foo=bar.
            if _LONG_WITH_VALUE.match(arg):
                index = arg.index("=")
                opt = cmd._find_option(arg[:index])
                if opt is not None and opt.kind == TAKES_VALUE:
                    self.emit_option(cmd, opt, arg[index + 1 :])
                    continue

            # An unknown option makes the arguments after it unknown too, so a
            # subcommand parses them again. A negative number in a leaf command
            # is not an option.
            if (
                not to_unknown
                and _maybe_option(arg)
                and not (len(cmd.commands) == 0 and self.negative_number_arg(cmd, arg))
            ):
                to_unknown = True
            (unknown if to_unknown else operands).append(arg)
        return operands, unknown

    def parse_command(self, cmd: Command, operands: List[str], unknown: List[str]) -> int:
        parsed_operands, parsed_unknown = self.parse_options(cmd, unknown)
        operands = operands + parsed_operands
        unknown = parsed_unknown
        args = operands + unknown

        if operands and cmd._find_command(operands[0]) is not None:
            return self.dispatch_subcommand(cmd, operands[0], operands[1:], unknown)
        if cmd.help_command is not None and operands and operands[0] == cmd.help_command:
            return self.dispatch_help_command(cmd, operands[1] if len(operands) > 1 else "")
        if cmd.default_command is not None:
            self.output_help_if_requested(cmd, unknown)
            return self.dispatch_subcommand(cmd, cmd.default_command, operands, unknown)
        if cmd.commands and not args and cmd.action is None:
            self.help(cmd, True)

        self.output_help_if_requested(cmd, unknown)

        if cmd.action is not None:
            self.check_for_unknown_options(cmd, unknown)
            processed = self.process_arguments(cmd, args)
            return self.run_action(cmd, processed)
        if operands:
            if cmd.commands:
                self.unknown_command(cmd, args[0])
            self.check_for_unknown_options(cmd, unknown)
            self.process_arguments(cmd, args)
            return 0
        self.check_for_unknown_options(cmd, unknown)
        if cmd.commands:
            self.help(cmd, True)
        self.process_arguments(cmd, args)
        return 0

    def dispatch_subcommand(self, cmd: Command, name: str, operands: List[str], unknown: List[str]) -> int:
        sub = cmd._find_command(name)
        if sub is None:
            self.help(cmd, True)
        assert sub is not None
        return self.parse_command(sub, operands, unknown)

    def dispatch_help_command(self, cmd: Command, name: str) -> int:
        if not name:
            self.help(cmd, False)
        sub = cmd._find_command(name)
        if sub is not None:
            self.help(sub, False)
        flag = cmd.help_long or cmd.help_short or "--help"
        return self.dispatch_subcommand(cmd, name, [], [flag])

    def output_help_if_requested(self, cmd: Command, args: List[str]) -> None:
        if any(cmd._is_help_flag(a) for a in args):
            self.stdout.write(cmd.help)
            raise _Exit(0)

    def check_for_unknown_options(self, cmd: Command, unknown: List[str]) -> None:
        if unknown:
            self.unknown_option(cmd, unknown[0])

    def process_arguments(self, cmd: Command, args: List[str]) -> List[Any]:
        for i, arg in enumerate(cmd.arguments):
            if arg.required and i >= len(args):
                self.error(cmd, f"error: missing required argument '{arg.name}'", "commander.missingArgument")
        n = len(cmd.arguments)
        if not (n > 0 and cmd.arguments[-1].variadic) and len(args) > n:
            for_subcommand = f" for '{cmd.name}'" if cmd.parent is not None else ""
            s = "" if n == 1 else "s"
            self.error(
                cmd,
                f"error: too many arguments{for_subcommand}. Expected {n} argument{s} but got {len(args)}.",
                "commander.excessArguments",
            )
        processed: List[Any] = []
        for i, arg in enumerate(cmd.arguments):
            if arg.variadic:
                processed.append(list(args[i:]))
            else:
                processed.append(args[i] if i < len(args) else None)
        return processed

    def unknown_option(self, cmd: Command, flag: str) -> None:
        suggestion = suggest_similar(flag, cmd.option_suggestions) if flag.startswith("--") else ""
        self.error(cmd, f"error: unknown option '{flag}'{suggestion}", "commander.unknownOption")

    def unknown_command(self, cmd: Command, name: str) -> None:
        suggestion = suggest_similar(name, cmd.command_suggestions)
        self.error(cmd, f"error: unknown command '{name}'{suggestion}", "commander.unknownCommand")

    def opts_with_globals(self, cmd: Command) -> Dict[str, Any]:
        combined: Dict[str, Any] = {}
        at: Optional[Command] = cmd
        while at is not None:
            combined.update(self.values[id(at)])
            at = at.parent
        return combined

    def run_action(self, cmd: Command, args: List[Any]) -> int:
        from .extract import run_extract

        action = cmd.action
        assert action is not None
        opts = self.values[id(cmd)]
        if action.extract:
            code, out, err = run_extract(self.p.extract, args, opts)
            self.stdout.write(out)
            self.stderr.write(err)
            return code
        assert action.command_id is not None
        globals_ = self.opts_with_globals(cmd)
        if action.introspect and _truthy(globals_, "introspect"):
            result = introspect(action.command_id, self.p.policy.get(action.command_id), globals_)
            self.stdout.write(stringify(result, 2) + "\n")
            return 0
        show_prompt = action.llm and _truthy(opts, "showPrompt")
        outcome = self.p.dispatch(action.command_id, Invocation(args=args, opts=dict(opts), globals=globals_))
        if show_prompt and outcome.prompt is not None:
            self.stdout.write(outcome.prompt + "\n")
        return outcome.exit_code


# ─── suggestions (lib/suggestSimilar.js) ─────────────────────────────

_MAX_DISTANCE = 3


def _units(s: str) -> List[int]:
    """A string as JavaScript's UTF-16 code units."""
    data = s.encode("utf-16-le", "surrogatepass")
    return [data[i] | (data[i + 1] << 8) for i in range(0, len(data), 2)]


def _edit_distance(a: List[int], b: List[int]) -> int:
    if abs(len(a) - len(b)) > _MAX_DISTANCE:
        return max(len(a), len(b))
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for j in range(1, len(b) + 1):
        for i in range(1, len(a) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len(a)][len(b)]


def _collation_key(c: str) -> Tuple[int, bool]:
    """The order of a character in the root collation ``String.prototype.localeCompare``
    uses, for the characters of option and command names: punctuation (``_``
    before ``-``), then digits, then letters alphabetically without regard to
    case; any other character by its code point after them."""
    o = ord(c)
    if c == "_":
        return 1, False
    if c == "-":
        return 2, False
    if "0" <= c <= "9":
        return 200 + o - ord("0"), False
    if "a" <= c <= "z":
        return 300 + o - ord("a"), False
    if "A" <= c <= "Z":
        return 300 + o - ord("A"), True
    if o < 0x80:
        return 3 + o, False
    return 1000 + o, False


def _locale_key(s: str) -> Tuple[List[int], List[bool]]:
    keys = [_collation_key(c) for c in s]
    return [k[0] for k in keys], [k[1] for k in keys]


def suggest_similar(word: str, candidates: List[str]) -> str:
    if not candidates:
        return ""
    unique = list(dict.fromkeys(candidates))
    searching_options = word.startswith("--")
    if searching_options:
        word = word[2:]
        unique = [c[2:] for c in unique]
    w = _units(word)
    similar: List[str] = []
    best_distance = _MAX_DISTANCE
    min_similarity = 0.4
    for candidate in unique:
        c = _units(candidate)
        if len(c) <= 1:
            continue
        distance = _edit_distance(w, c)
        length = max(len(w), len(c))
        similarity = (length - distance) / length
        if similarity > min_similarity:
            if distance < best_distance:
                best_distance = distance
                similar = [candidate]
            elif distance == best_distance:
                similar.append(candidate)
    similar.sort(key=_locale_key)
    if searching_options:
        similar = ["--" + c for c in similar]
    if len(similar) > 1:
        return "\n(Did you mean one of " + ", ".join(similar) + "?)"
    if len(similar) == 1:
        return "\n(Did you mean " + similar[0] + "?)"
    return ""


def outcome(result: Any) -> Outcome:
    """The outcome of what a handler returned: None (exit 0), an exit code, a
    prompt (exit 0; written with ``--show-prompt``), or an exit code and a
    prompt."""
    if result is None:
        return Outcome()
    if isinstance(result, bool):
        raise TypeError("a handler returns an exit code, not a bool")
    if isinstance(result, int):
        return Outcome(exit_code=result)
    if isinstance(result, str):
        return Outcome(prompt=result)
    if isinstance(result, tuple) and len(result) == 2:
        return Outcome(exit_code=result[0], prompt=result[1])
    raise TypeError(f"a handler returns None, an exit code or a prompt, not {result!r}")
