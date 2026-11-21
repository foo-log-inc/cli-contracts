package cli_contracts_runtime

import (
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// The parsing of an invocation, by the rules of commander 14 (lib/command.js:
// parseOptions, _parseCommand, _dispatchSubcommand, _dispatchHelpCommand,
// _processArguments, addOption's value handling, optsWithGlobals, version,
// _outputHelpIfRequested and the error messages), over the parts of commander
// a generated program uses. The TypeScript program generated from the same
// contract is commander itself; test/conformance compares the two.

// UsageError is an invocation the program rejects: an unknown option or
// command, an option without its value, a missing or an excess argument. Code
// is commander's code for the error.
type UsageError struct {
	Code     string
	Message  string
	ExitCode int
}

// ProgramOptions configure a program.
type ProgramOptions struct {
	// OnUsageError ends an invocation the program rejects: it writes what the
	// contract declares for invalid arguments and returns the exit code. The
	// program then writes nothing of its own. Without it, the program writes
	// its message and exits 1.
	OnUsageError func(err UsageError, command *Command) int
}

// Program is a generated program.
type Program struct {
	Root    *Command
	Version string
	Options ProgramOptions
	// Policy holds the policy definitions by command id, for `--introspect`.
	Policy map[string]Value
	// Extract holds the output of the built-in extract command.
	Extract *ExtractSpec
}

// NewProgram links the tree and returns the program.
func NewProgram(root *Command, version string, options ProgramOptions, policy map[string]Value, extract *ExtractSpec) *Program {
	root.link()
	return &Program{Root: root, Version: version, Options: options, Policy: policy, Extract: extract}
}

// Main runs the program with the process's arguments and exits with its exit code.
func (p *Program) Main() {
	os.Exit(p.Run(os.Args[1:], os.Stdout, os.Stderr))
}

type exit struct{ code int }

type run struct {
	p      *Program
	stdout io.Writer
	stderr io.Writer
	values map[*Command]*Object
	// given holds the keys of each command the invocation set (an option's
	// default is replaced, not added to, by the first value given).
	given map[*Command]map[string]bool
}

// Run parses an invocation, runs what it names and returns the exit code.
func (p *Program) Run(argv []string, stdout, stderr io.Writer) (code int) {
	r := &run{p: p, stdout: stdout, stderr: stderr, values: map[*Command]*Object{}, given: map[*Command]map[string]bool{}}
	defer func() {
		if v := recover(); v != nil {
			e, ok := v.(exit)
			if !ok {
				panic(v)
			}
			code = e.code
		}
	}()
	r.prepare(p.Root)
	return r.parseCommand(p.Root, nil, argv)
}

func (r *run) prepare(cmd *Command) {
	values := NewObject()
	for _, iv := range cmd.InitialValues {
		values.Set(iv.Key, iv.Value)
	}
	r.values[cmd] = values
	for _, sub := range cmd.Commands {
		r.prepare(sub)
	}
}

func (r *run) exit(code int) {
	panic(exit{code})
}

func (r *run) help(cmd *Command, isError bool) {
	if isError {
		io.WriteString(r.stderr, cmd.Help)
		r.exit(1)
	}
	io.WriteString(r.stdout, cmd.Help)
	r.exit(0)
}

func (r *run) error(cmd *Command, message, code string) {
	err := UsageError{Code: code, Message: message, ExitCode: 1}
	if r.p.Options.OnUsageError != nil {
		r.exit(r.p.Options.OnUsageError(err, cmd))
	}
	io.WriteString(r.stderr, message+"\n")
	r.exit(1)
}

func maybeOption(arg string) bool {
	return len(arg) > 1 && arg[0] == '-'
}

var negativeNumber = regexp.MustCompile(`^-(\d+|\d*\.\d+)(e[+-]?\d+)?$`)

func (r *run) negativeNumberArg(cmd *Command, arg string) bool {
	return negativeNumber.MatchString(arg) && !cmd.DigitShortOption
}

// jsLen is the length of a string in UTF-16 code units, as JavaScript counts it.
func jsLen(s string) int {
	n := 0
	for _, c := range s {
		if c >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

// secondChar splits a string after its first byte into JavaScript's arg[1]
// and arg.slice(2). A character outside the BMP is two code units, of which
// arg[1] holds only the first; no flag matches it.
func secondChar(arg string) (char string, rest string, ok bool) {
	c, size := utf8.DecodeRuneInString(arg[1:])
	if c >= 0x10000 {
		return "", "", false
	}
	return arg[1 : 1+size], arg[1+size:], true
}

var longWithValue = regexp.MustCompile(`^--[^=]+=`)

func (r *run) emitOption(cmd *Command, opt *Option, value *string) {
	if opt.Version {
		io.WriteString(r.stdout, r.p.Version+"\n")
		r.exit(0)
	}
	values := r.values[cmd]
	given := r.given[cmd]
	if given == nil {
		given = map[string]bool{}
		r.given[cmd] = given
	}
	defer func() { given[opt.Key] = true }()
	if value == nil {
		values.Set(opt.Key, opt.Kind != Negate)
		return
	}
	if opt.Variadic {
		// A value given replaces the default and is added to the values given before it.
		if previous, ok := values.Get(opt.Key); ok && given[opt.Key] {
			if list, ok := previous.([]string); ok {
				values.Set(opt.Key, append(append([]string{}, list...), *value))
				return
			}
		}
		values.Set(opt.Key, []string{*value})
		return
	}
	values.Set(opt.Key, *value)
}

func (r *run) parseOptions(cmd *Command, args []string) (operands, unknown []string) {
	operands = []string{}
	unknown = []string{}
	toUnknown := false
	push := func(items ...string) {
		if toUnknown {
			unknown = append(unknown, items...)
		} else {
			operands = append(operands, items...)
		}
	}
	var activeVariadic *Option
	activeGroup := ""
	hasGroup := false
	i := 0
	for i < len(args) || hasGroup {
		var arg string
		if hasGroup {
			arg = activeGroup
			hasGroup = false
		} else {
			arg = args[i]
			i++
		}

		if arg == "--" {
			if toUnknown {
				unknown = append(unknown, arg)
			}
			push(args[i:]...)
			break
		}

		if activeVariadic != nil && (!maybeOption(arg) || r.negativeNumberArg(cmd, arg)) {
			v := arg
			r.emitOption(cmd, activeVariadic, &v)
			continue
		}
		activeVariadic = nil

		if maybeOption(arg) {
			if opt := cmd.findOption(arg); opt != nil {
				if opt.Kind == TakesValue {
					if i >= len(args) {
						r.error(cmd, fmt.Sprintf("error: option '%s' argument missing", opt.Flags), "commander.optionMissingArgument")
					}
					v := args[i]
					i++
					r.emitOption(cmd, opt, &v)
				} else {
					r.emitOption(cmd, opt, nil)
				}
				if opt.Variadic {
					activeVariadic = opt
				}
				continue
			}
		}

		// Combined short options, like -abc: the first one if known.
		if jsLen(arg) > 2 && arg[0] == '-' && arg[1] != '-' {
			if char, rest, ok := secondChar(arg); ok {
				if opt := cmd.findOption("-" + char); opt != nil {
					if opt.Kind == TakesValue {
						v := rest
						r.emitOption(cmd, opt, &v)
					} else {
						r.emitOption(cmd, opt, nil)
						activeGroup = "-" + rest
						hasGroup = true
					}
					continue
				}
			}
		}

		// A known long option with its value, like --foo=bar.
		if longWithValue.MatchString(arg) {
			index := strings.IndexByte(arg, '=')
			if opt := cmd.findOption(arg[:index]); opt != nil && opt.Kind == TakesValue {
				v := arg[index+1:]
				r.emitOption(cmd, opt, &v)
				continue
			}
		}

		// An unknown option makes the arguments after it unknown too, so a
		// subcommand parses them again. A negative number in a leaf command is
		// not an option.
		if !toUnknown && maybeOption(arg) && !(len(cmd.Commands) == 0 && r.negativeNumberArg(cmd, arg)) {
			toUnknown = true
		}
		push(arg)
	}
	return operands, unknown
}

func (r *run) parseCommand(cmd *Command, operands, unknown []string) int {
	parsedOperands, parsedUnknown := r.parseOptions(cmd, unknown)
	operands = append(append([]string{}, operands...), parsedOperands...)
	unknown = parsedUnknown
	args := append(append([]string{}, operands...), unknown...)

	if len(operands) > 0 && cmd.findCommand(operands[0]) != nil {
		return r.dispatchSubcommand(cmd, operands[0], operands[1:], unknown)
	}
	if cmd.HelpCommand != "" && len(operands) > 0 && operands[0] == cmd.HelpCommand {
		second := ""
		if len(operands) > 1 {
			second = operands[1]
		}
		return r.dispatchHelpCommand(cmd, second)
	}
	if cmd.DefaultCommand != "" {
		r.outputHelpIfRequested(cmd, unknown)
		return r.dispatchSubcommand(cmd, cmd.DefaultCommand, operands, unknown)
	}
	if len(cmd.Commands) > 0 && len(args) == 0 && cmd.Action == nil {
		r.help(cmd, true)
	}

	r.outputHelpIfRequested(cmd, parsedUnknown)

	checkForUnknownOptions := func() {
		if len(parsedUnknown) > 0 {
			r.unknownOption(cmd, parsedUnknown[0])
		}
	}

	if cmd.Action != nil {
		checkForUnknownOptions()
		processed := r.processArguments(cmd, args)
		return r.runAction(cmd, processed)
	}
	if len(operands) > 0 {
		if len(cmd.Commands) > 0 {
			r.unknownCommand(cmd, args[0])
		}
		checkForUnknownOptions()
		r.processArguments(cmd, args)
		return 0
	}
	checkForUnknownOptions()
	if len(cmd.Commands) > 0 {
		r.help(cmd, true)
	}
	r.processArguments(cmd, args)
	return 0
}

func (r *run) dispatchSubcommand(cmd *Command, name string, operands, unknown []string) int {
	sub := cmd.findCommand(name)
	if sub == nil {
		r.help(cmd, true)
	}
	return r.parseCommand(sub, operands, unknown)
}

func (r *run) dispatchHelpCommand(cmd *Command, name string) int {
	if name == "" {
		r.help(cmd, false)
	}
	if sub := cmd.findCommand(name); sub != nil {
		r.help(sub, false)
	}
	flag := "--help"
	if cmd.HelpLong != "" {
		flag = cmd.HelpLong
	} else if cmd.HelpShort != "" {
		flag = cmd.HelpShort
	}
	return r.dispatchSubcommand(cmd, name, nil, []string{flag})
}

func (r *run) outputHelpIfRequested(cmd *Command, args []string) {
	for _, arg := range args {
		if cmd.isHelpFlag(arg) {
			io.WriteString(r.stdout, cmd.Help)
			r.exit(0)
		}
	}
}

func (r *run) processArguments(cmd *Command, args []string) []Arg {
	for i, arg := range cmd.Arguments {
		if arg.Required && i >= len(args) {
			r.error(cmd, fmt.Sprintf("error: missing required argument '%s'", arg.Name), "commander.missingArgument")
		}
	}
	n := len(cmd.Arguments)
	if !(n > 0 && cmd.Arguments[n-1].Variadic) && len(args) > n {
		forSubcommand := ""
		if cmd.parent != nil {
			forSubcommand = fmt.Sprintf(" for '%s'", cmd.Name)
		}
		s := "s"
		if n == 1 {
			s = ""
		}
		r.error(cmd, fmt.Sprintf("error: too many arguments%s. Expected %d argument%s but got %d.", forSubcommand, n, s, len(args)), "commander.excessArguments")
	}
	processed := make([]Arg, n)
	for i, arg := range cmd.Arguments {
		switch {
		case arg.Variadic:
			values := []string{}
			if i < len(args) {
				values = append(values, args[i:]...)
			}
			processed[i] = Arg{Present: true, Values: values}
		case i < len(args):
			processed[i] = Arg{Present: true, Value: args[i]}
		}
	}
	return processed
}

func (r *run) unknownOption(cmd *Command, flag string) {
	suggestion := ""
	if strings.HasPrefix(flag, "--") {
		suggestion = suggestSimilar(flag, cmd.OptionSuggestions)
	}
	r.error(cmd, fmt.Sprintf("error: unknown option '%s'%s", flag, suggestion), "commander.unknownOption")
}

func (r *run) unknownCommand(cmd *Command, name string) {
	suggestion := suggestSimilar(name, cmd.CommandSuggestions)
	r.error(cmd, fmt.Sprintf("error: unknown command '%s'%s", name, suggestion), "commander.unknownCommand")
}

// optsWithGlobals merges the option values of a command and its ancestors,
// an ancestor's value replacing the command's.
func (r *run) optsWithGlobals(cmd *Command) *Object {
	combined := NewObject()
	for at := cmd; at != nil; at = at.parent {
		combined.Assign(r.values[at])
	}
	return combined
}

// truthy is JavaScript's truthiness of an option value.
func truthy(v Value, ok bool) bool {
	if !ok {
		return false
	}
	switch x := v.(type) {
	case bool:
		return x
	case string:
		return x != ""
	case nil:
		return false
	default:
		return true
	}
}

func (r *run) runAction(cmd *Command, args []Arg) int {
	opts := r.values[cmd]
	switch cmd.Action.Kind {
	case RunsExtract:
		return r.extract(args, opts)
	case RunsHandler:
		action := cmd.Action
		globals := r.optsWithGlobals(cmd)
		if action.Introspect && truthy(globals.Get("introspect")) {
			result := Introspect(action.CommandID, r.p.Policy[action.CommandID], globals)
			io.WriteString(r.stdout, Stringify(result, 2)+"\n")
			return 0
		}
		outcome := action.Handler(&Invocation{Args: args, Opts: opts, Globals: globals})
		if action.LLM && truthy(opts.Get("showPrompt")) && outcome.Prompt != nil {
			io.WriteString(r.stdout, *outcome.Prompt+"\n")
		}
		return outcome.ExitCode
	}
	return 0
}

// toUTF16 is a string as JavaScript's code units.
func toUTF16(s string) []uint16 {
	return utf16.Encode([]rune(s))
}
