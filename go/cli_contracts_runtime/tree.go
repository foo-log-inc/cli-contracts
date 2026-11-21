package cli_contracts_runtime

// The command tree of a generated program, as commander builds it for the
// contract (cli-contracts src/generators/commander-tree.ts). The generator
// writes it as a literal; the program parses an invocation over it.

// OptionKind is what an option does when it is given.
type OptionKind int

const (
	// Flag sets the option's key to true.
	Flag OptionKind = iota
	// Negate sets the option's key to false (`--no-<name>`).
	Negate
	// TakesValue takes the next argument as the option's value.
	TakesValue
)

// Option is an option as commander registers it.
type Option struct {
	Flags string
	Short string
	Long  string
	// Name is the long flag without its dashes; commander keys the option's events by it.
	Name string
	// Key is the key the value is kept under (`dry-run` -> `dryRun`).
	Key  string
	Kind OptionKind
	// Variadic collects every value given into a list.
	Variadic bool
	// Version is the program's `-V, --version`.
	Version bool
}

// InitialValue is an option value before parsing (a default).
type InitialValue struct {
	Key   string
	Value Value
}

// Argument is a command argument.
type Argument struct {
	Name     string
	Required bool
	Variadic bool
}

// ActionKind is what a command runs.
type ActionKind int

const (
	// RunsHandler runs the handler of a contract command.
	RunsHandler ActionKind = iota + 1
	// RunsExtract runs the built-in extract command.
	RunsExtract
)

// Arg is the value a handler receives for an argument.
type Arg struct {
	// Present is false for an optional argument not given.
	Present bool
	Value   string
	// Values holds a variadic argument's values (empty when none is given).
	Values []string
}

// Invocation is what a command's handler receives.
type Invocation struct {
	Args []Arg
	// Opts holds the command's own option values (commander's opts()).
	Opts *Object
	// Globals holds the option values of the command and its ancestors, an
	// ancestor's value replacing the command's (commander's optsWithGlobals()).
	Globals *Object
}

// Outcome is what a handler returns: the exit code, and for a command that
// takes `--adapter`, the prompt it built (written with `--show-prompt`).
type Outcome struct {
	ExitCode int
	Prompt   *string
}

// Handler runs a contract command.
type Handler func(inv *Invocation) Outcome

// Action is what a command runs.
type Action struct {
	Kind      ActionKind
	CommandID string
	// LLM: with `--show-prompt`, the command writes the prompt its handler returns.
	LLM bool
	// Introspect: with `--introspect`, the command writes its derived policy instead of running.
	Introspect bool
	Handler    Handler
}

// Command is a command of the program.
type Command struct {
	Name          string
	Options       []*Option
	InitialValues []InitialValue
	Arguments     []Argument
	Commands      []*Command
	Hidden        bool
	// DefaultCommand is the subcommand run when none is named.
	DefaultCommand string
	// HelpCommand is the name of the implicit help command, when the command has one.
	HelpCommand string
	HelpShort   string
	HelpLong    string
	Action      *Action
	// Help is the help commander writes for the command.
	Help string
	// OptionSuggestions are the long flags an unknown option is compared with.
	OptionSuggestions []string
	// CommandSuggestions are the names an unknown command is compared with.
	CommandSuggestions []string
	// DigitShortOption: an option of the command or an ancestor has a digit as its short flag.
	DigitShortOption bool

	parent *Command
}

func (c *Command) link() {
	for _, sub := range c.Commands {
		sub.parent = c
		sub.link()
	}
}

// Parent returns the command's parent, nil for the program.
func (c *Command) Parent() *Command {
	return c.parent
}

func (c *Command) findCommand(name string) *Command {
	if name == "" {
		return nil
	}
	for _, sub := range c.Commands {
		if sub.Name == name {
			return sub
		}
	}
	return nil
}

func (c *Command) findOption(arg string) *Option {
	for _, opt := range c.Options {
		if (opt.Short != "" && opt.Short == arg) || (opt.Long != "" && opt.Long == arg) {
			return opt
		}
	}
	return nil
}

func (c *Command) isHelpFlag(arg string) bool {
	return (c.HelpShort != "" && arg == c.HelpShort) || (c.HelpLong != "" && arg == c.HelpLong)
}

// Optional returns an optional argument's value, nil when it is not given.
func (a Arg) Optional() *string {
	if !a.Present {
		return nil
	}
	v := a.Value
	return &v
}

// CommandOption sets a part of a command built with Cmd.
type CommandOption func(*Command)

// Cmd builds a command: its name, the help it writes, and its parts.
func Cmd(name, help string, parts ...CommandOption) *Command {
	c := &Command{Name: name, Help: help}
	for _, part := range parts {
		part(c)
	}
	return c
}

// Options sets the command's options, in registration order.
func Options(options ...*Option) CommandOption {
	return func(c *Command) { c.Options = options }
}

// Initial sets the option values before parsing, from alternating keys and values.
func Initial(pairs ...Value) CommandOption {
	return func(c *Command) {
		for i := 0; i+1 < len(pairs); i += 2 {
			c.InitialValues = append(c.InitialValues, InitialValue{Key: pairs[i].(string), Value: pairs[i+1]})
		}
	}
}

// Arguments sets the command's arguments.
func Arguments(args ...Argument) CommandOption {
	return func(c *Command) { c.Arguments = args }
}

// Subcommands sets the command's subcommands, in registration order.
func Subcommands(commands ...*Command) CommandOption {
	return func(c *Command) { c.Commands = commands }
}

// Hidden leaves the command out of its parent's help.
func Hidden() CommandOption {
	return func(c *Command) { c.Hidden = true }
}

// DefaultSubcommand names the subcommand run when none is named.
func DefaultSubcommand(name string) CommandOption {
	return func(c *Command) { c.DefaultCommand = name }
}

// ImplicitHelpCommand names the command's implicit help command.
func ImplicitHelpCommand(name string) CommandOption {
	return func(c *Command) { c.HelpCommand = name }
}

// HelpFlags sets the short and long flag of the command's help option ("" for none).
func HelpFlags(short, long string) CommandOption {
	return func(c *Command) { c.HelpShort, c.HelpLong = short, long }
}

// RunsCommand makes the command run a contract command's handler.
func RunsCommand(commandID string, llm, introspect bool, handler Handler) CommandOption {
	return func(c *Command) {
		c.Action = &Action{Kind: RunsHandler, CommandID: commandID, LLM: llm, Introspect: introspect, Handler: handler}
	}
}

// RunsBuiltinExtract makes the command the built-in extract command.
func RunsBuiltinExtract() CommandOption {
	return func(c *Command) { c.Action = &Action{Kind: RunsExtract} }
}

// Suggestions sets the long flags and command names an unknown option or command is compared with.
func Suggestions(options, commands []string) CommandOption {
	return func(c *Command) { c.OptionSuggestions, c.CommandSuggestions = options, commands }
}

// DigitShortOptions records that an option of the command or an ancestor has a digit as its short flag.
func DigitShortOptions() CommandOption {
	return func(c *Command) { c.DigitShortOption = true }
}
