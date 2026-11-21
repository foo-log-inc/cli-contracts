# cli-contracts-runtime

The runtime of the Python programs and command wrappers [cli-contracts](https://github.com/foo-log-inc/cli-contracts) generates from a CLI contract (`templates: builtin:python`). A generated program holds its command tree and handler protocol; this package parses an invocation over the tree by the same rules as the TypeScript program generated from the same contract (commander), and writes the same help, errors, `--introspect` policy and `extract` output.

```bash
pip install cli-contracts-runtime
```

Python 3.9 or later. The package uses the standard library only.

## Usage

Generate the package (`cli-contracts.config.yaml`):

```yaml
generators:
  python:
    enabled: true
    output: ./tool/cli
    templates: builtin:python
```

Implement the handlers and run the program:

```python
import sys

import cli_contracts_runtime

from tool import cli


class Handlers:
    # One method per command of the contract; it returns the exit code (None for 0).
    def users_import(self, file, options, parent_opts):
        if options.get("dryRun"):
            print("dry run:", file)
        return 0


def on_usage_error(err, command):
    # Optional: ends an invocation the program rejects with what the contract declares.
    sys.stderr.write('{"code":"INVALID_ARGS","message":%s}\n' % cli_contracts_runtime.quote(err.message))
    return 2


if __name__ == "__main__":
    cli.create_program(Handlers(), "1.0.0", on_usage_error).main()
```

The options a handler receives are a dict of the options given or defaulted, keyed as the program keys them (`dry-run` → `dryRun`); `parent_opts` holds those of the command and its ancestors. A command that takes `--adapter` may return the prompt it built, or `(exit_code, prompt)`; the program writes the prompt with `--show-prompt`.

`Program.run(argv, stdout, stderr)` runs an invocation without exiting and returns its exit code.

## License

MIT
