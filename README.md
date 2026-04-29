# CLI Contracts

[![npm version](https://img.shields.io/npm/v/cli-contracts.svg)](https://www.npmjs.com/package/cli-contracts)
[![license](https://img.shields.io/npm/l/cli-contracts.svg)](https://github.com/foo-ogawa/cli-contracts/blob/main/LICENSE)

Contract-first specification and toolchain for command line interfaces.

CLI tools are APIs too — but most of them are documented manually, tested loosely, and changed without compatibility checks.

CLI Contracts brings an OpenAPI-like contract-first workflow to command line interfaces: define the contract once, then use it to generate types, documentation, wrappers, contract tests, and breaking-change reports.

CLI Contracts makes CLI tools contract-first in the same sense that OpenAPI makes HTTP APIs contract-first — but focuses on the full lifecycle of CLI interfaces: validation, type generation, documentation, contract testing, breaking-change detection, and AI-agent-safe execution.

For teams that expose CLIs to users, CI/CD pipelines, automation scripts, and AI agents, CLI Contracts provides a single source of truth for commands, inputs, outputs, exit codes, generated files, streams, tests, and breaking changes.

## Why CLI Contracts?

CLIs are APIs. They have inputs, outputs, errors, compatibility concerns, and consumers — humans, scripts, CI jobs, and AI agents.

But unlike HTTP APIs, most CLIs do not have a contract-first workflow. Documentation drifts from implementation, breaking changes go undetected, and there is no standard way to validate that a CLI conforms to its own specification.

CLI Contracts brings an OpenAPI-like workflow to command line tools: define the contract once, then use it to generate types, docs, wrappers, tests, and breaking-change reports.

CLI Contracts can also make CLIs safer for AI agents by declaring side effects, risk levels, confirmation requirements, idempotency, and safe dry-run options through the `x-agent` extension.

## What it does

Use the same contract to:

- **Define** commands, arguments, options, exit codes, stdout/stderr schemas, files, and streams in a single YAML contract
- **Validate** contracts for structural correctness, duplicate IDs, invalid refs, and exit code consistency
- **Generate** TypeScript types, CLI wrappers, Markdown documentation, and custom output via Handlebars templates
- **Test** real CLI implementations against the contract
- **Diff** contract versions to detect breaking changes before release
- **Describe AI agent policies** — risk level, side effects, idempotency, confirmation, and safe dry-run options via `x-agent`

Key contract features:

- stdout, stderr, and generated files can be contracted per exit code with format and JSON Schema
- stdin/stdout/stderr streaming is modeled with framing, item schemas, and flush policies
- file arguments and options carry media types, encodings, and schemas
- `$ref` and shared components allow modular, reusable definitions

## Install

```bash
npm install cli-contracts
```

## Quick Start

```bash
# Initialize a new contract
cli-contracts init --name my-tool

# Validate
cli-contracts validate

# Generate docs + code (requires cli-contracts.config.yaml)
cli-contracts generate

# Generate Markdown docs only
cli-contracts docs --output docs/cli-reference.md

# Run contract tests against a real CLI
cli-contracts test

# Detect breaking changes
cli-contracts diff old.yaml new.yaml
```

After running `generate`, you get:

```
src/generated/
  types.ts       # argument/option interfaces, exit code unions, result types
  commands.ts    # typed CLI execution wrappers
  schemas.ts     # JSON Schema constants and exit code arrays
  program.ts     # Commander program definition (createProgram + CommandHandlers)
docs/
  cli-reference.md  # human-readable CLI reference documentation
```

## Contract File

The primary artifact is `cli-contract.yaml`. It describes one or more CLI executables, their commands, inputs, outputs, and behavior.

```yaml
cliContracts: 0.1.0

info:
  title: My CLI Contracts
  version: 1.0.0

commandSets:
  my-tool:
    summary: My command line tool.
    globalOptions:
      - name: verbose
        aliases: [v]
        schema:
          type: boolean
          default: false

    commands:
      users.import:
        summary: Import users from CSV.
        arguments:
          - name: input
            required: true
            description: Input CSV file.
            schema:
              type: string
            file:
              mode: read
              exists: true
              mediaType: text/csv
        options:
          - name: dry-run
            aliases: [n]
            description: Validate only.
            schema:
              type: boolean
              default: false
        exits:
          '0':
            description: Import succeeded.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/ImportResult'
          '2':
            description: Invalid argument.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'
        x-agent:
          riskLevel: high
          requiresConfirmation: true
          idempotent: false
          sideEffects:
            - database_write
          safeDryRunOption: dry-run

components:
  schemas:
    ImportResult:
      type: object
      required: [status, importedCount]
      properties:
        status:
          type: string
        importedCount:
          type: integer
          minimum: 0
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
```

### Top-level fields

| Field | Required | Description |
|---|:---:|---|
| `cliContracts` | Yes | Specification version (`0.1.0`) |
| `info` | Yes | Title, version, description, license, contact |
| `commandSets` | Yes | One or more CLI executables or command groups |
| `components` | No | Shared schemas, examples, and reusable definitions |

### Command set fields

| Field | Required | Description |
|---|:---:|---|
| `executable` | No | User-facing executable name. Defaults to the command set key |
| `summary` | No | Short description |
| `commands` | Yes | Map of commands keyed by stable command ID |
| `globalOptions` | No | Options accepted by all commands in this set |
| `env` | No | Public environment variables (part of the interface) |

### Command fields

| Field | Required | Description |
|---|:---:|---|
| `summary` | Yes | Short description |
| `description` | No | Long description |
| `path` | No | CLI subcommand path override. Defaults to ID with `.` replaced by spaces |
| `usage` | No | Human-readable usage examples |
| `arguments` | No | Positional arguments |
| `options` | No | Named options and flags |
| `streams` | No | stdin/stdout/stderr contracts during execution |
| `signals` | No | OS signals the command handles |
| `exits` | Yes | Exit-code keyed output contracts |
| `examples` | No | Usage examples |

### Path derivation

The CLI invocation path is derived from the command ID by replacing `.` with spaces:

```
command set key: my-tool
command ID:      users.import  →  my-tool users import
command ID:      init          →  my-tool init
```

An explicit `path` field can override this when the CLI syntax differs from the ID.

### Arguments

| Field | Required | Description |
|---|:---:|---|
| `name` | Yes | Argument name |
| `index` | No | Positional index (defaults to array order) |
| `required` | No | Whether the argument is required |
| `description` | No | Description |
| `schema` | No | JSON Schema for the value |
| `file` | No | File contract if the value is a file path |
| `variadic` | No | Accepts multiple values |

### Options

| Field | Required | Description |
|---|:---:|---|
| `name` | Yes | Long option name without `--` |
| `aliases` | No | Short aliases without `-` |
| `required` | No | Whether the option is required |
| `valueName` | No | Display name for the value |
| `description` | No | Description |
| `schema` | No | JSON Schema for the value |
| `file` | No | File contract if the value is a file path |
| `repeatable` | No | Can be specified multiple times |

### Exit codes

`exits` is a map keyed by exit code (0–255). Each exit defines what the command outputs.

```yaml
exits:
  '0':
    description: Success.
    stdout:
      format: json
      schema:
        $ref: '#/components/schemas/Result'
  '2':
    description: Invalid argument.
    stderr:
      format: json
      schema:
        $ref: '#/components/schemas/Error'
```

Each exit can specify `stdout`, `stderr`, and `files` (generated files). Output contracts have:

| Field | Required | Description |
|---|:---:|---|
| `format` | Yes | `json`, `yaml`, `text`, `ndjson`, `table`, etc. |
| `required` | No | Whether this output is required (default: `true` when defined) |
| `schema` | No | JSON Schema or `$ref` for the output |
| `examples` | No | Named examples |

### File contracts

Arguments or options whose values point to files can declare file contracts:

```yaml
file:
  mode: read          # read, write, append, readWrite
  exists: true        # must exist before execution
  mediaType: text/csv
  encoding: utf-8
  schema:
    $ref: ./schemas/input.schema.json
```

### Streams

`streams` models stdin/stdout/stderr during execution (as opposed to `exits`, which models output at exit).

```yaml
streams:
  stdin:
    required: true
    format: ndjson
    framing:
      type: line-delimited
      delimiter: '\n'
    itemSchema:
      $ref: '#/components/schemas/LogEvent'
  stdout:
    format: ndjson
    framing:
      type: line-delimited
    itemSchema:
      $ref: '#/components/schemas/FilteredEvent'
    flush:
      policy: perItem
```

### Signals

```yaml
signals:
  SIGINT:
    description: Gracefully stops processing and flushes output.
  SIGTERM:
    description: Immediately terminates.
```

### Extensions (`x-*`)

Properties prefixed with `x-` carry domain-specific metadata. The `x-agent` extension describes AI agent execution policy:

```yaml
x-agent:
  riskLevel: high
  requiresConfirmation: true
  idempotent: false
  sideEffects:
    - database_write
  safeDryRunOption: dry-run
  recommendedBeforeUse:
    - Validate the CSV schema.
    - Run with --dry-run before actual import.
```

## Config File

`cli-contracts.config.yaml` defines how tooling validates, generates, and tests. The contract defines **what** the interface is; the config defines **how** to process it.

```yaml
version: 0.1.0

input:
  files:
    - cli-contract.yaml

generators:
  typescript:
    enabled: true
    output: ./src/generated
    templates: builtin:typescript
    options:
      emitTypes: true
      emitClient: true
      emitValidators: true
      emitProgram: true

  markdown:
    enabled: true
    output: ./docs/cli-reference.md
    templates: builtin:markdown
    options:
      includeSchemas: true
      includeExtensions: true

executionProfiles:
  local:
    default: true
    commandSets:
      my-tool:
        command: my-tool

contractTests:
  enabled: true
  profile: local
  casesDir: ./tests/cli-contracts
  timeoutMs: 30000
```

## CLI Commands

| Command | Description |
|---|---|
| `cli-contracts init` | Initialize a contract file or project layout |
| `cli-contracts validate` | Validate contract syntax, refs, and structure |
| `cli-contracts generate` | Run code generators from config |
| `cli-contracts docs` | Generate Markdown documentation |
| `cli-contracts test` | Run contract tests against a real CLI |
| `cli-contracts diff <old> <new>` | Detect breaking changes between versions |

### Global options

| Option | Alias | Description |
|---|---|---|
| `--config <file>` | `-c` | Path to `cli-contracts.config.yaml` |
| `--verbose` | `-v` | Enable verbose output |
| `--quiet` | `-q` | Suppress non-error output |
| `--version` | `-V` | Print version |
| `--help` | `-h` | Show help |

### init

| Option | Alias | Default | Description |
|---|---|---|---|
| `--name <name>` | `-n` | | Executable name for the initial command set |
| `--multi-command-set` | `-m` | `false` | Scaffold multiple command sets |
| `--output <dir>` | `-o` | `.` | Output directory |
| `--with-config` | | `false` | Also generate `cli-contracts.config.yaml` |

### validate

| Option | Alias | Default | Description |
|---|---|---|---|
| `--file <files...>` | `-f` | config input | Contract file(s) to validate |
| `--strict` | | `false` | Treat warnings as errors |
| `--resolve-refs` | | `true` | Resolve and validate `$ref` targets |

### generate

| Argument | Description |
|---|---|
| `[generators...]` | Generator name(s) to run. If omitted, all enabled generators run |

| Option | Alias | Default | Description |
|---|---|---|---|
| `--file <files...>` | `-f` | config input | Contract file(s) |
| `--output <dir>` | `-o` | | Override output directory |
| `--dry-run` | `-n` | `false` | Show what would be generated |
| `--clean` | | `false` | Remove output before generating |

### docs

| Option | Alias | Description |
|---|---|---|
| `--file <files...>` | `-f` | Contract file(s) |
| `--output <file>` | `-o` | Output file path |

### test

| Option | Alias | Default | Description |
|---|---|---|---|
| `--profile <name>` | `-p` | | Execution profile to use |
| `--case <ids...>` | | | Run specific test case(s) by ID |
| `--cases-dir <dir>` | | | Test case directory |
| `--timeout <ms>` | `-t` | `30000` | Timeout per test case |
| `--bail` | | `false` | Stop on first failure |

### diff

| Argument | Description |
|---|---|
| `<old>` | Path to the old contract file |
| `<new>` | Path to the new contract file |

| Option | Default | Description |
|---|---|---|
| `--breaking-only` | `false` | Only report breaking changes |
| `--format <format>` | `json` | Output format (`json` or `text`) |

For full details on every command, option, exit code, and output schema, see the [CLI Reference](docs/cli-reference.md).

## Generators

### TypeScript (`builtin:typescript`)

Generates typed interfaces, command wrappers, and a Commander program definition from the contract.

```
src/generated/
  index.ts       # re-exports
  types.ts       # argument/option interfaces, exit code unions, result types
  commands.ts    # typed CLI execution wrappers
  schemas.ts     # JSON Schema constants and exit code arrays
  program.ts     # Commander program definition (createProgram + CommandHandlers)
```

Example generated types:

```typescript
export type UsersImportExitCode = 0 | 2 | 10;

export type UsersImportExitResult =
  | { exitCode: 0; stdout: ImportResult }
  | { exitCode: 2; stderr: Error }
  | { exitCode: 10; stdout?: ImportResult; stderr: Error };
```

The generated `program.ts` allows contract-driven CLI wiring:

```typescript
import { createProgram } from "./generated/program.js";

const program = createProgram({
  async usersImport(input, options, parentOpts) {
    // only implement handlers — interface comes from the contract
  },
}, "1.0.0");

program.parse();
```

### Markdown (`builtin:markdown`)

Generates human-readable CLI reference documentation with command tables, option tables, exit code contracts, schema property tables, and collapsible JSON Schema details.

### Custom (Handlebars)

Custom generators use Handlebars templates with a manifest:

```
templates/go/
  generator.yaml
  types.go.hbs
  command.go.hbs
```

```yaml
name: go
description: Generate Go command wrappers.
entrypoints:
  - template: types.go.hbs
    output: '{{options.packageName}}/types.go'
  - template: command.go.hbs
    output: '{{options.packageName}}/{{commandSet.id}}_commands.go'
    each: commandSets
```

## Contract Tests

Contract tests verify that a real CLI implementation conforms to the contract. Test cases are YAML files:

```yaml
id: users.import.success
commandSet: my-tool
command: users.import
args:
  input: ./fixtures/users.csv
options:
  dry-run: true
expect:
  exitCode: 0
  stdout:
    matchesSchema: '#/components/schemas/ImportResult'
  stderr:
    absent: true
```

```bash
cli-contracts test --profile local
```

## Breaking Change Detection

```bash
cli-contracts diff old.yaml new.yaml
```

Detects breaking changes including:

- Removed commands or command sets
- Changed executable names
- Removed or reordered arguments
- Added required arguments or options
- Removed options or exit codes
- Incompatible schema changes

## Programmatic API

```typescript
import {
  parseContractFile,
  validateContract,
  resolveRefs,
  normalizeContract,
  generateMarkdown,
  generateTypeScript,
  CliContractsDocumentSchema,
} from "cli-contracts";

const doc = await parseContractFile("cli-contract.yaml");
const validation = validateContract(doc);

if (validation.valid) {
  const resolved = resolveRefs(doc);
  const ctx = normalizeContract(resolved);

  const markdown = generateMarkdown(ctx);
  const typescript = generateTypeScript(ctx);
}
```

Zod schemas are also exported for programmatic use:

```typescript
import { CliContractsDocumentSchema } from "cli-contracts";

const result = CliContractsDocumentSchema.safeParse(rawYamlObject);
```

## Why not OpenCLI?

OpenCLI is an important effort toward a standard, language-agnostic description format for command line interfaces.

CLI Contracts started with a similar problem space, and OpenCLI was considered as a possible foundation. However, CLI Contracts intentionally uses its own contract format because it focuses on a broader contract-first workflow:

- per-exit stdout/stderr/file contracts
- JSON Schema-based output validation
- streaming input/output contracts
- contract tests against real CLI implementations
- breaking-change detection
- TypeScript type and wrapper generation
- AI-agent execution policies such as side effects, risk level, idempotency, and confirmation requirements

OpenCLI primarily describes how a CLI is invoked. CLI Contracts describes how a CLI behaves as an interface.

The goal is not to compete with OpenCLI as a standard, but to provide a practical toolchain for teams that need stronger guarantees around CLI compatibility, automation, and agent-safe execution.

## CLI Contracts vs OpenCLI

OpenCLI focuses on describing CLI shape. CLI Contracts focuses on defining, generating, testing, and evolving CLI behavior.

| Area | OpenCLI | CLI Contracts |
|---|---|---|
| Primary goal | Standard CLI description format | Contract-first CLI toolchain |
| Invocation model | Commands, arguments, options | Commands, arguments, options |
| Exit codes | Basic description | First-class output contracts per exit code |
| stdout/stderr | Limited | Format and schema per exit |
| File I/O | Limited or implementation-dependent | First-class file contracts |
| Streams | Not the main focus | First-class stdin/stdout/stderr stream contracts |
| Validation | Specification validation | Contract validation and `$ref` resolution |
| Code generation | Possible ecosystem use case | Built-in TypeScript generation |
| Contract testing | Not the core focus | Built-in contract tests against real CLIs |
| Breaking changes | Possible use case | Built-in diff command |
| AI agents | Possible use case | Explicit `x-agent` policy extension |
| Design stance | Standard-first | Toolchain-first |

## CLI Contracts is not a CLI framework

CLI Contracts does not replace Commander, oclif, Click, Typer, Cobra, or other CLI frameworks.

You can build your CLI with any framework. CLI Contracts defines the external contract of the CLI and provides validation, generation, testing, and compatibility tooling around it.

In other words:

- CLI frameworks implement command behavior
- CLI Contracts defines and verifies the interface contract

| Tool | Focus | Relationship to CLI Contracts |
|---|---|---|
| Commander | Node.js command parser | CLI Contracts can generate Commander program definitions |
| oclif | Node.js CLI framework | Can be used as the implementation layer |
| Click / Typer | Python CLI frameworks | Can be described by CLI Contracts |
| Cobra | Go CLI framework | Can be described by CLI Contracts |
| OpenCLI | CLI description specification | Different scope; CLI Contracts focuses on the full contract lifecycle |
| OpenAPI | HTTP API contracts | Conceptual inspiration for contract-first workflows |

## OpenCLI compatibility

CLI Contracts is not currently based on OpenCLI.

Import/export support may be considered in the future if there is enough demand and if the mapping can preserve CLI Contracts features such as exit-specific output contracts, stream contracts, contract tests, and agent policies.

## Design Principles

1. **Contract first** — `cli-contract.yaml` is the canonical source of truth
2. **Commands are a map** — stable IDs for diffing, codegen, and references
3. **Exit codes are first-class** — per-exit stdout/stderr/files contracts
4. **Files are first-class** — input/output files with media types and schemas
5. **Streams are first-class** — stdin/stdout/stderr during execution with framing
6. **JSON Schema compatible** — data schemas use JSON Schema
7. **Template-based generation** — Handlebars templates for any language
8. **Extensible via `x-*`** — domain metadata without polluting the core schema
9. **Runtime is config, not contract** — binary paths, Docker invocation, and env vars belong in config

## JSON Schema

CLI Contracts uses JSON Schema for data contracts embedded in arguments, options, exit outputs, streams, and file definitions.

The supported JSON Schema dialect is determined by the validator implementation and will be documented before 1.0. The contract format itself is validated using Zod, and machine-readable JSON Schema files for the contract and config formats are published in the `schemas/` directory:

- `schemas/cli-contract.schema.json` — schema for `cli-contract.yaml`
- `schemas/cli-contracts.config.schema.json` — schema for `cli-contracts.config.yaml`

These can be used for IDE autocompletion:

```yaml
# yaml-language-server: $schema=./node_modules/cli-contracts/schemas/cli-contract.schema.json
cliContracts: 0.1.0
```

## Recommended Project Layout

```
repo/
  cli-contract.yaml               # contract (source of truth)
  cli-contracts.config.yaml       # tooling config
  schemas/                        # external JSON Schemas
  templates/                      # custom generator templates
  src/generated/                  # generated TypeScript
  docs/
    cli-reference.md              # generated documentation
  tests/
    cli-contracts/                # contract test cases
      users.import.success.yaml
```

## Status

CLI Contracts is currently pre-1.0. The contract format may evolve based on feedback, but the goal is to keep migration paths explicit and detectable through `cli-contracts diff`.

The current contract format version is `0.1.0`.

## License

MIT
