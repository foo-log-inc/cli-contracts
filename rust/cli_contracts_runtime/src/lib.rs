//! The runtime of the Rust programs and command wrappers cli-contracts
//! generates from a CLI contract. A generated program holds its command tree
//! and dispatches to its handlers; this crate parses an invocation over the
//! tree by commander's rules, so the program behaves as the TypeScript program
//! generated from the same contract.

pub mod client;
pub mod extract;
pub mod json;
pub mod policy;
pub mod program;
mod suggest;
pub mod tree;

pub use client::{exec, format_number, ExecResult};
pub use extract::{ExtractSet, ExtractSpec};
pub use json::{arr, num, obj, quote, stringify, Object, Value};
pub use policy::introspect;
pub use program::{Dispatch, Program, ProgramOptions, UsageError, UsageErrorHandler};
pub use tree::{Action, Arg, Argument, CliOption, Command, Invocation, OptionKind, Outcome};

/// The version of cli-contracts this runtime belongs to.
pub const VERSION: &str = "0.35.4";
