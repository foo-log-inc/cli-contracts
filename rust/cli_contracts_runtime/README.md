# cli_contracts_runtime

The runtime for the Rust programs and command wrappers that [cli-contracts](https://github.com/foo-log-inc/cli-contracts) generates from a CLI contract (`templates: builtin:rust`). A generated program holds its command tree and handler trait; this crate parses an invocation over the tree by the same rules as the TypeScript program generated from the same contract (which uses commander), and writes the same help, errors, `--introspect` policy and `extract` output.

```toml
[dependencies]
cli_contracts_runtime = "0.36"
```

Rust 1.70 or later. The crate has no dependencies.

## Usage

Generate the module (`cli-contracts.config.yaml`):

```yaml
generators:
  rust:
    enabled: true
    output: ./src/cli
    templates: builtin:rust
```

Implement the handlers and run the program:

```rust
mod cli;

use cli_contracts_runtime as rt;

struct Handlers;

impl cli::CommandHandlers for Handlers {
    // One method per command of the contract; it returns the exit code.
    fn users_import(&mut self, file: String, options: cli::UsersImportHandlerOptions, _parent_opts: &rt::Object) -> i32 {
        if options.dry_run == Some(true) {
            println!("dry run: {file}");
        }
        0
    }
}

fn main() {
    let options = rt::ProgramOptions {
        // Optional: for an invocation the program rejects, writes what the contract declares for invalid arguments and returns the exit code.
        on_usage_error: Some(Box::new(|err: &rt::UsageError, _command: &rt::Command| {
            eprintln!("{{\"code\":\"INVALID_ARGS\",\"message\":{}}}", rt::quote(&err.message));
            2
        })),
    };
    cli::Program::new(Handlers, "1.0.0", options).main()
}
```

An option a handler receives is `None` when it is not given and has no default. `parent_opts` holds the option values of the command and its ancestors, keyed as the program keys them (`dry-run` → `dryRun`). A command that takes `--adapter` returns `(exit_code, Option<prompt>)`; the program writes the prompt with `--show-prompt`.

`Program::run(&argv, &mut stdout, &mut stderr)` runs an invocation (`argv` without the program name) without exiting and returns its exit code.

## License

MIT
