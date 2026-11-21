//! The parsing of an invocation, by the rules of commander 14 (lib/command.js:
//! parseOptions, _parseCommand, _dispatchSubcommand, _dispatchHelpCommand,
//! _processArguments, addOption's value handling, optsWithGlobals, version,
//! _outputHelpIfRequested and the error messages), over the parts of commander
//! a generated program uses. The TypeScript program generated from the same
//! contract is commander itself; test/conformance compares the two.

use std::collections::{HashMap, HashSet};
use std::io::Write;

use crate::extract::ExtractSpec;
use crate::json::{stringify, Object, Value};
use crate::policy::introspect;
use crate::suggest::suggest_similar;
use crate::tree::{Action, Arg, Command, Invocation, OptionKind, Outcome};

/// An invocation the program rejects: an unknown option or command, an option
/// without its value, a missing or an excess argument. `code` is commander's
/// code for the error.
#[derive(Debug, Clone, PartialEq)]
pub struct UsageError {
    pub code: &'static str,
    pub message: String,
    pub exit_code: i32,
}

/// Ends an invocation the program rejects: writes what the contract declares
/// for invalid arguments and returns the exit code. The program then writes
/// nothing of its own.
pub type UsageErrorHandler = Box<dyn FnMut(&UsageError, &Command) -> i32>;

/// The options of a program.
#[derive(Default)]
pub struct ProgramOptions {
    /// Without it, the program writes the error's message and exits 1.
    pub on_usage_error: Option<UsageErrorHandler>,
}

/// A generated program: the tree, the version `--version` writes, and what
/// `--introspect` and the built-in extract command write.
pub struct Program {
    pub root: Command,
    pub version: String,
    pub options: ProgramOptions,
    /// The policy definitions by command id.
    pub policy: HashMap<String, Value>,
    pub extract: Option<ExtractSpec>,
}

/// Runs a contract command: given its id and invocation, returns the outcome.
pub type Dispatch<'a> = dyn FnMut(&str, &Invocation) -> Outcome + 'a;

/// An exit, with its code, before the invocation reaches its end.
type Flow<T> = Result<T, i32>;

struct Run<'a> {
    root: &'a Command,
    version: &'a str,
    on_usage_error: &'a mut Option<UsageErrorHandler>,
    policy: &'a HashMap<String, Value>,
    extract: Option<&'a ExtractSpec>,
    stdout: &'a mut dyn Write,
    stderr: &'a mut dyn Write,
    dispatch: &'a mut Dispatch<'a>,
    values: HashMap<Vec<usize>, Object>,
    /// The keys of each command the invocation set.
    given: HashSet<(Vec<usize>, &'static str)>,
}

impl Program {
    /// Parses an invocation, runs what it names and returns the exit code.
    pub fn run(
        &mut self,
        argv: &[String],
        stdout: &mut dyn Write,
        stderr: &mut dyn Write,
        dispatch: &mut Dispatch<'_>,
    ) -> i32 {
        let mut run = Run {
            root: &self.root,
            version: &self.version,
            on_usage_error: &mut self.options.on_usage_error,
            policy: &self.policy,
            extract: self.extract.as_ref(),
            stdout,
            stderr,
            dispatch,
            values: HashMap::new(),
            given: HashSet::new(),
        };
        run.prepare(&mut Vec::new());
        let code = match run.parse_command(&[], Vec::new(), argv.to_vec()) {
            Ok(code) | Err(code) => code,
        };
        let _ = run.stdout.flush();
        let _ = run.stderr.flush();
        code
    }
}

fn maybe_option(arg: &str) -> bool {
    arg.len() > 1 && arg.starts_with('-')
}

/// `^-(\d+|\d*\.\d+)(e[+-]?\d+)?$`
fn is_negative_number(arg: &str) -> bool {
    let Some(rest) = arg.strip_prefix('-') else {
        return false;
    };
    let (mantissa, exponent) = match rest.find('e') {
        Some(i) => (&rest[..i], Some(&rest[i + 1..])),
        None => (rest, None),
    };
    let digits = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit());
    let mantissa_ok = match mantissa.find('.') {
        None => digits(mantissa),
        Some(i) => mantissa[..i].bytes().all(|b| b.is_ascii_digit()) && digits(&mantissa[i + 1..]),
    };
    let exponent_ok = match exponent {
        None => true,
        Some(e) => digits(e.strip_prefix(['+', '-']).unwrap_or(e)),
    };
    mantissa_ok && exponent_ok
}

/// The length of a string in UTF-16 code units, as JavaScript counts it.
fn js_len(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `^--[^=]+=`: the index of the `=`.
fn long_with_value(arg: &str) -> Option<usize> {
    if !arg.starts_with("--") {
        return None;
    }
    match arg[2..].find('=') {
        Some(i) if i > 0 => Some(i + 2),
        _ => None,
    }
}

/// JavaScript's truthiness of an option value.
fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

impl<'a> Run<'a> {
    fn node(&self, path: &[usize]) -> &'a Command {
        let mut cmd = self.root;
        for &i in path {
            cmd = &cmd.commands[i];
        }
        cmd
    }

    fn prepare(&mut self, path: &mut Vec<usize>) {
        let cmd = self.node(path);
        let mut values = Object::new();
        for (k, v) in &cmd.initial_values {
            values.set(k, v.clone());
        }
        self.values.insert(path.clone(), values);
        for i in 0..cmd.commands.len() {
            path.push(i);
            self.prepare(path);
            path.pop();
        }
    }

    fn write_out(&mut self, text: &str) {
        let _ = self.stdout.write_all(text.as_bytes());
    }

    fn write_err(&mut self, text: &str) {
        let _ = self.stderr.write_all(text.as_bytes());
    }

    fn help<T>(&mut self, path: &[usize], is_error: bool) -> Flow<T> {
        let help = self.node(path).help;
        if is_error {
            self.write_err(help);
            Err(1)
        } else {
            self.write_out(help);
            Err(0)
        }
    }

    fn error<T>(&mut self, path: &[usize], message: String, code: &'static str) -> Flow<T> {
        let err = UsageError {
            code,
            message,
            exit_code: 1,
        };
        let cmd = self.node(path);
        if let Some(handler) = self.on_usage_error.as_mut() {
            return Err(handler(&err, cmd));
        }
        self.write_err(&format!("{}\n", err.message));
        Err(1)
    }

    fn negative_number_arg(&self, path: &[usize], arg: &str) -> bool {
        is_negative_number(arg) && !self.node(path).digit_short_option
    }

    fn emit_option(&mut self, path: &[usize], index: usize, value: Option<String>) -> Flow<()> {
        let opt = &self.node(path).options[index];
        if opt.version {
            let text = format!("{}\n", self.version);
            self.write_out(&text);
            return Err(0);
        }
        // A value given replaces the default and is added to the values given before it.
        let given_before = !self.given.insert((path.to_vec(), opt.key));
        let values = self.values.get_mut(path).expect("prepared");
        match value {
            None => values.set(opt.key, Value::Bool(opt.kind != OptionKind::Negate)),
            Some(v) if opt.variadic => {
                let next = match values.get(opt.key) {
                    Some(Value::Array(items)) if given_before => {
                        let mut items = items.clone();
                        items.push(Value::String(v));
                        items
                    }
                    _ => vec![Value::String(v)],
                };
                values.set(opt.key, Value::Array(next));
            }
            Some(v) => values.set(opt.key, Value::String(v)),
        }
        Ok(())
    }

    fn option_index(&self, path: &[usize], arg: &str) -> Option<usize> {
        let cmd = self.node(path);
        cmd.find_option(arg)
            .and_then(|o| cmd.options.iter().position(|p| std::ptr::eq(p, o)))
    }

    fn parse_options(
        &mut self,
        path: &[usize],
        args: &[String],
    ) -> Flow<(Vec<String>, Vec<String>)> {
        let mut operands: Vec<String> = Vec::new();
        let mut unknown: Vec<String> = Vec::new();
        let mut to_unknown = false;
        let mut active_variadic: Option<usize> = None;
        let mut active_group: Option<String> = None;
        let mut i = 0;
        while i < args.len() || active_group.is_some() {
            let arg = match active_group.take() {
                Some(group) => group,
                None => {
                    i += 1;
                    args[i - 1].clone()
                }
            };

            if arg == "--" {
                let dest = if to_unknown {
                    &mut unknown
                } else {
                    &mut operands
                };
                if to_unknown {
                    dest.push(arg);
                }
                dest.extend(args[i..].iter().cloned());
                break;
            }

            if let Some(index) = active_variadic {
                if !maybe_option(&arg) || self.negative_number_arg(path, &arg) {
                    self.emit_option(path, index, Some(arg))?;
                    continue;
                }
            }
            active_variadic = None;

            if maybe_option(&arg) {
                if let Some(index) = self.option_index(path, &arg) {
                    let opt = &self.node(path).options[index];
                    if opt.kind == OptionKind::TakesValue {
                        if i >= args.len() {
                            let message = format!("error: option '{}' argument missing", opt.flags);
                            return self.error(path, message, "commander.optionMissingArgument");
                        }
                        let value = args[i].clone();
                        i += 1;
                        self.emit_option(path, index, Some(value))?;
                    } else {
                        self.emit_option(path, index, None)?;
                    }
                    if opt.variadic {
                        active_variadic = Some(index);
                    }
                    continue;
                }
            }

            // Combined short options, like -abc: the first one if known. A
            // character outside the BMP is two code units in JavaScript, of
            // which arg[1] holds only the first; no flag matches it.
            if js_len(&arg) > 2 && arg.starts_with('-') && !arg[1..].starts_with('-') {
                let second = arg[1..].chars().next().expect("non-empty");
                if (second as u32) < 0x10000 {
                    let rest = &arg[1 + second.len_utf8()..];
                    if let Some(index) = self.option_index(path, &format!("-{second}")) {
                        if self.node(path).options[index].kind == OptionKind::TakesValue {
                            self.emit_option(path, index, Some(rest.to_string()))?;
                        } else {
                            self.emit_option(path, index, None)?;
                            active_group = Some(format!("-{rest}"));
                        }
                        continue;
                    }
                }
            }

            // A known long option with its value, like --foo=bar.
            if let Some(eq) = long_with_value(&arg) {
                if let Some(index) = self.option_index(path, &arg[..eq]) {
                    if self.node(path).options[index].kind == OptionKind::TakesValue {
                        self.emit_option(path, index, Some(arg[eq + 1..].to_string()))?;
                        continue;
                    }
                }
            }

            // An unknown option makes the arguments after it unknown too, so a
            // subcommand parses them again. A negative number in a leaf command
            // is not an option.
            let leaf = self.node(path).commands.is_empty();
            if !to_unknown && maybe_option(&arg) && !(leaf && self.negative_number_arg(path, &arg))
            {
                to_unknown = true;
            }
            if to_unknown {
                unknown.push(arg);
            } else {
                operands.push(arg);
            }
        }
        Ok((operands, unknown))
    }

    fn parse_command(
        &mut self,
        path: &[usize],
        operands: Vec<String>,
        unknown: Vec<String>,
    ) -> Flow<i32> {
        let (parsed_operands, parsed_unknown) = self.parse_options(path, &unknown)?;
        let mut operands = operands;
        operands.extend(parsed_operands);
        let unknown = parsed_unknown;
        let mut args = operands.clone();
        args.extend(unknown.iter().cloned());
        let cmd = self.node(path);

        if let Some(first) = operands.first() {
            if let Some(index) = cmd.find_command(first) {
                return self.parse_subcommand(path, index, operands[1..].to_vec(), unknown);
            }
        }
        if let (Some(help_command), Some(first)) = (cmd.help_command, operands.first()) {
            if first == help_command {
                let name = operands.get(1).cloned().unwrap_or_default();
                return self.dispatch_help_command(path, &name);
            }
        }
        if let Some(default) = cmd.default_command {
            self.output_help_if_requested(path, &unknown)?;
            return self.dispatch_subcommand(path, default, operands, unknown);
        }
        if !cmd.commands.is_empty() && args.is_empty() && cmd.action.is_none() {
            return self.help(path, true);
        }

        self.output_help_if_requested(path, &unknown)?;

        if cmd.action.is_some() {
            self.check_for_unknown_options(path, &unknown)?;
            let processed = self.process_arguments(path, &args)?;
            return self.run_action(path, processed);
        }
        if !operands.is_empty() {
            if !cmd.commands.is_empty() {
                return self.unknown_command(path, &args[0]);
            }
            self.check_for_unknown_options(path, &unknown)?;
            self.process_arguments(path, &args)?;
            return Ok(0);
        }
        self.check_for_unknown_options(path, &unknown)?;
        if !cmd.commands.is_empty() {
            return self.help(path, true);
        }
        self.process_arguments(path, &args)?;
        Ok(0)
    }

    fn parse_subcommand(
        &mut self,
        path: &[usize],
        index: usize,
        operands: Vec<String>,
        unknown: Vec<String>,
    ) -> Flow<i32> {
        let mut sub = path.to_vec();
        sub.push(index);
        self.parse_command(&sub, operands, unknown)
    }

    fn dispatch_subcommand(
        &mut self,
        path: &[usize],
        name: &str,
        operands: Vec<String>,
        unknown: Vec<String>,
    ) -> Flow<i32> {
        match self.node(path).find_command(name) {
            Some(index) => self.parse_subcommand(path, index, operands, unknown),
            None => self.help(path, true),
        }
    }

    fn dispatch_help_command(&mut self, path: &[usize], name: &str) -> Flow<i32> {
        if name.is_empty() {
            return self.help(path, false);
        }
        let cmd = self.node(path);
        if let Some(index) = cmd.find_command(name) {
            let mut sub = path.to_vec();
            sub.push(index);
            return self.help(&sub, false);
        }
        let flag = cmd.help_long.or(cmd.help_short).unwrap_or("--help");
        self.dispatch_subcommand(path, name, Vec::new(), vec![flag.to_string()])
    }

    fn output_help_if_requested(&mut self, path: &[usize], args: &[String]) -> Flow<()> {
        let cmd = self.node(path);
        if args.iter().any(|a| cmd.is_help_flag(a)) {
            self.write_out(cmd.help);
            return Err(0);
        }
        Ok(())
    }

    fn check_for_unknown_options(&mut self, path: &[usize], unknown: &[String]) -> Flow<()> {
        match unknown.first() {
            Some(flag) => self.unknown_option(path, flag),
            None => Ok(()),
        }
    }

    fn process_arguments(&mut self, path: &[usize], args: &[String]) -> Flow<Vec<Arg>> {
        let cmd = self.node(path);
        for (i, arg) in cmd.arguments.iter().enumerate() {
            if arg.required && i >= args.len() {
                let message = format!("error: missing required argument '{}'", arg.name);
                return self.error(path, message, "commander.missingArgument");
            }
        }
        let n = cmd.arguments.len();
        let last_variadic = cmd.arguments.last().map(|a| a.variadic).unwrap_or(false);
        if !last_variadic && args.len() > n {
            let for_subcommand = if path.is_empty() {
                String::new()
            } else {
                format!(" for '{}'", cmd.name)
            };
            let s = if n == 1 { "" } else { "s" };
            let message = format!(
                "error: too many arguments{for_subcommand}. Expected {n} argument{s} but got {}.",
                args.len()
            );
            return self.error(path, message, "commander.excessArguments");
        }
        Ok(cmd
            .arguments
            .iter()
            .enumerate()
            .map(|(i, arg)| {
                if arg.variadic {
                    Arg::Many(args.get(i..).map(|s| s.to_vec()).unwrap_or_default())
                } else {
                    args.get(i)
                        .map(|s| Arg::One(s.clone()))
                        .unwrap_or(Arg::Absent)
                }
            })
            .collect())
    }

    fn unknown_option<T>(&mut self, path: &[usize], flag: &str) -> Flow<T> {
        let suggestion = if flag.starts_with("--") {
            suggest_similar(flag, &self.node(path).option_suggestions)
        } else {
            String::new()
        };
        self.error(
            path,
            format!("error: unknown option '{flag}'{suggestion}"),
            "commander.unknownOption",
        )
    }

    fn unknown_command<T>(&mut self, path: &[usize], name: &str) -> Flow<T> {
        let suggestion = suggest_similar(name, &self.node(path).command_suggestions);
        self.error(
            path,
            format!("error: unknown command '{name}'{suggestion}"),
            "commander.unknownCommand",
        )
    }

    /// The option values of a command and its ancestors, an ancestor's value
    /// replacing the command's.
    fn opts_with_globals(&self, path: &[usize]) -> Object {
        let mut combined = Object::new();
        for depth in (0..=path.len()).rev() {
            combined.assign(&self.values[&path[..depth].to_vec()]);
        }
        combined
    }

    fn run_action(&mut self, path: &[usize], args: Vec<Arg>) -> Flow<i32> {
        let cmd = self.node(path);
        let opts = self.values[&path.to_vec()].clone();
        match cmd.action.as_ref().expect("has an action") {
            Action::Extract => {
                let spec = self
                    .extract
                    .expect("the program has the built-in extract command");
                let (code, out, err) = crate::extract::run_extract(spec, &args, &opts);
                self.write_out(&out);
                self.write_err(&err);
                Ok(code)
            }
            Action::Command {
                command_id,
                llm,
                introspect: introspects,
            } => {
                let globals = self.opts_with_globals(path);
                if *introspects && truthy(globals.get("introspect")) {
                    let definition = self.policy.get(*command_id).cloned().unwrap_or(Value::Null);
                    let result = introspect(command_id, &definition, &globals);
                    let text = format!("{}\n", stringify(&result, 2));
                    self.write_out(&text);
                    return Ok(0);
                }
                let show_prompt = *llm && truthy(opts.get("showPrompt"));
                let outcome = (self.dispatch)(
                    command_id,
                    &Invocation {
                        args,
                        opts,
                        globals,
                    },
                );
                if show_prompt {
                    if let Some(prompt) = outcome.prompt {
                        self.write_out(&format!("{prompt}\n"));
                    }
                }
                Ok(outcome.exit_code)
            }
        }
    }
}
