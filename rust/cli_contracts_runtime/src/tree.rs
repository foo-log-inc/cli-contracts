//! The command tree of a generated program, as commander builds it for the
//! contract (cli-contracts `src/generators/commander-tree.ts`). The generator
//! writes it as a literal; the program parses an invocation over it.

use crate::json::{Object, Value};

/// What an option does when it is given.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum OptionKind {
    /// Sets the option's key to true.
    #[default]
    Flag,
    /// Sets the option's key to false (`--no-<name>`).
    Negate,
    /// Takes the next argument as the option's value.
    TakesValue,
}

/// An option as commander registers it.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CliOption {
    pub flags: &'static str,
    pub short: Option<&'static str>,
    pub long: Option<&'static str>,
    /// The long flag without its dashes; commander keys the option's events by it.
    pub name: &'static str,
    /// The key the value is kept under (`dry-run` -> `dryRun`).
    pub key: &'static str,
    pub kind: OptionKind,
    /// Collects every value given into an array.
    pub variadic: bool,
    /// The program's `-V, --version`.
    pub version: bool,
}

/// A command argument.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Argument {
    pub name: &'static str,
    pub required: bool,
    pub variadic: bool,
}

/// What a command runs.
#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    /// The handler of a contract command.
    Command {
        command_id: &'static str,
        /// With `--show-prompt`, the command writes the prompt its handler returns.
        llm: bool,
        /// With `--introspect`, the command writes its derived policy instead of running.
        introspect: bool,
    },
    /// The built-in extract command.
    Extract,
}

/// A command of the program.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Command {
    pub name: &'static str,
    pub options: Vec<CliOption>,
    /// Option values before parsing (the defaults), by key.
    pub initial_values: Vec<(&'static str, Value)>,
    pub arguments: Vec<Argument>,
    pub commands: Vec<Command>,
    pub hidden: bool,
    /// The subcommand run when none is named.
    pub default_command: Option<&'static str>,
    /// The implicit help command's name, when the command has one.
    pub help_command: Option<&'static str>,
    pub help_short: Option<&'static str>,
    pub help_long: Option<&'static str>,
    pub action: Option<Action>,
    /// The help commander writes for the command.
    pub help: &'static str,
    /// The long flags an unknown option is compared with.
    pub option_suggestions: Vec<&'static str>,
    /// The names an unknown command is compared with.
    pub command_suggestions: Vec<&'static str>,
    /// An option of the command or an ancestor has a digit as its short flag.
    pub digit_short_option: bool,
}

impl Command {
    pub(crate) fn find_command(&self, name: &str) -> Option<usize> {
        if name.is_empty() {
            return None;
        }
        self.commands.iter().position(|c| c.name == name)
    }

    pub(crate) fn find_option(&self, arg: &str) -> Option<&CliOption> {
        self.options
            .iter()
            .find(|o| o.short == Some(arg) || o.long == Some(arg))
    }

    pub(crate) fn is_help_flag(&self, arg: &str) -> bool {
        self.help_short == Some(arg) || self.help_long == Some(arg)
    }
}

/// The value a handler receives for an argument.
#[derive(Debug, Clone, PartialEq)]
pub enum Arg {
    /// An optional argument not given.
    Absent,
    One(String),
    /// A variadic argument's values (empty when none is given).
    Many(Vec<String>),
}

impl Arg {
    /// A required argument's value.
    pub fn value(&self) -> String {
        match self {
            Arg::One(s) => s.clone(),
            _ => String::new(),
        }
    }

    /// An optional argument's value, `None` when it is not given.
    pub fn optional(&self) -> Option<String> {
        match self {
            Arg::One(s) => Some(s.clone()),
            _ => None,
        }
    }

    /// A variadic argument's values.
    pub fn values(&self) -> Vec<String> {
        match self {
            Arg::Many(v) => v.clone(),
            _ => Vec::new(),
        }
    }
}

/// What a command's handler receives.
#[derive(Debug, Clone, PartialEq)]
pub struct Invocation {
    pub args: Vec<Arg>,
    /// The command's own option values (commander's `opts()`).
    pub opts: Object,
    /// The option values of the command and its ancestors, an ancestor's value
    /// replacing the command's (commander's `optsWithGlobals()`).
    pub globals: Object,
}

/// What a handler returns: the exit code, and for a command that takes
/// `--adapter`, the prompt it built (written with `--show-prompt`).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Outcome {
    pub exit_code: i32,
    pub prompt: Option<String>,
}
