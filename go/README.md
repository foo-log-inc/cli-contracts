# cli-contracts Go runtime

The runtime of the Go programs and command wrappers [cli-contracts](https://github.com/foo-log-inc/cli-contracts) generates from a CLI contract (`templates: builtin:go`). A generated program holds its command tree and handler interface; this module parses an invocation over the tree by the same rules as the TypeScript program generated from the same contract (commander), and writes the same help, errors, `--introspect` policy and `extract` output.

```bash
go get github.com/foo-log-inc/cli-contracts/go@v0.36.0
```

Go 1.21 or later. The module uses the standard library only.

## Usage

Generate the package (`cli-contracts.config.yaml`):

```yaml
generators:
  go:
    enabled: true
    output: ./internal/cli
    templates: builtin:go
    options:
      package: cli
```

Implement the handlers and run the program:

```go
package main

import (
	"fmt"
	"os"

	"example.com/tool/internal/cli"
	rt "github.com/foo-log-inc/cli-contracts/go/cli_contracts_runtime"
)

type handlers struct{}

// One method per command of the contract; it returns the exit code.
func (handlers) UsersImport(file string, options cli.UsersImportHandlerOptions, parentOpts *rt.Object) int {
	if options.DryRun != nil && *options.DryRun {
		fmt.Println("dry run:", file)
	}
	return 0
}

func main() {
	cli.NewProgram(handlers{}, "1.0.0", rt.ProgramOptions{
		// Optional: ends an invocation the program rejects with what the contract declares.
		OnUsageError: func(err rt.UsageError, command *rt.Command) int {
			fmt.Fprintf(os.Stderr, "{\"code\":\"INVALID_ARGS\",\"message\":%s}\n", rt.Quote(err.Message))
			return 2
		},
	}).Main()
}
```

An option a handler receives is nil when it is not given and has no default. `parentOpts` holds the option values of the command and its ancestors, keyed as the program keys them (`dry-run` → `dryRun`). A command that takes `--adapter` returns `(exitCode, prompt)`; the program writes the prompt with `--show-prompt`.

`Program.Run(argv, stdout, stderr)` runs an invocation without exiting and returns its exit code.

## License

MIT
