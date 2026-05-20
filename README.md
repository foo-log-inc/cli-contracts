# CLI Contracts

[![npm version](https://img.shields.io/npm/v/cli-contracts.svg)](https://www.npmjs.com/package/cli-contracts)
[![license](https://img.shields.io/npm/l/cli-contracts.svg)](https://github.com/foo-ogawa/cli-contracts/blob/main/LICENSE)

A contract-first toolchain for CLI interfaces.

CLI Contracts is a contract-first toolchain for CLI interfaces. It does not implement your CLI. Instead, it defines the external contract of your CLI and uses that contract to generate types, documentation, wrappers, contract tests, and breaking-change reports.

CLI tools are APIs too — but most of them are documented manually, tested loosely, and changed without compatibility checks. CLI Contracts brings an OpenAPI-like contract-first workflow to command line interfaces: define the contract once, then validate, generate, test, and diff.

For teams that expose CLIs to users, CI/CD pipelines, automation scripts, and AI agents, CLI Contracts provides a single source of truth for commands, inputs, outputs, exit codes, generated files, streams, tests, and breaking changes.

## Why CLI Contracts?

CLIs are APIs. They have inputs, outputs, errors, compatibility concerns, and consumers — humans, scripts, CI jobs, and AI agents.

But unlike HTTP APIs, most CLIs do not have a contract-first workflow. Documentation drifts from implementation, breaking changes go undetected, and there is no standard way to validate that a CLI conforms to its own specification.

CLI Contracts brings an OpenAPI-like workflow to command line tools: define the contract once, then use it to generate types, docs, wrappers, tests, and breaking-change reports.

CLI Contracts can also provide AI-agent execution policies through **option-level effect declarations** and runtime introspection (`--introspect`). Effects declare what a command does to the outside world (file writes, network calls, risk levels, idempotency) at both command and option granularity, enabling deterministic policy derivation without hand-written metadata. The `x-agent` extension remains available for non-derivable supplementary information (rollback, human review, recommendations).

## What it does

Use the same contract to:

- **Define** commands, arguments, options, exit codes, stdout/stderr schemas, files, and streams in a single YAML contract
- **Validate** contracts for structural correctness, duplicate IDs, invalid refs, and exit code consistency
- **Generate** TypeScript types, CLI wrappers, Markdown documentation, and custom output via Handlebars templates
- **Test** real CLI implementations against the contract
- **Diff** contract versions to detect breaking changes before release
- **Declare execution effects** — option-level and command-level effect declarations (writes, network, risk level, idempotency) with runtime introspection via `--introspect`
- **Declare AI-agent execution policies** — supplementary agent-facing metadata (rollback, human review, recommendations) via `x-agent`
- **Audit** contract design quality, propose `x-agent` policies, generate test cases, explain diffs, check LLM command conformance against the reference specification, and draft contracts from existing sources — all via LLM-backed commands

Key contract features:

- stdout, stderr, and generated files can be contracted per exit code with format and JSON Schema
- stdin/stdout/stderr streaming is modeled with framing, item schemas, and flush policies
- file arguments and options carry media types, encodings, and schemas
- `$ref` and shared components allow modular, reusable definitions

## Install

```bash
npm install --save-dev cli-contracts
```

CLI Contracts is a development-time toolchain. Install it as a devDependency and run commands via `npx` or npm scripts.

## Quick Start

```bash
# Initialize a new contract
npx cli-contracts init --name my-tool

# Validate
npx cli-contracts validate

# Generate docs + code (requires cli-contracts.config.yaml)
npx cli-contracts generate

# Generate Markdown docs only
npx cli-contracts docs --output docs/cli-reference.md

# Run contract tests against a real CLI
npx cli-contracts test

# Detect breaking changes
npx cli-contracts diff old.yaml new.yaml

# Introspect derived execution policy without running
npx cli-contracts generate --introspect

# Audit contract design quality (requires agent-contracts-runtime)
npx cli-contracts audit cli-contract.yaml --adapter gemini

# Check LLM command conformance against the reference specification
npx cli-contracts check-reference path/to/cli-contract.yaml --adapter openai

# Generate a contract draft from an existing README
npx cli-contracts suggest --from-readme README.md --adapter cursor
```

After running `generate`, you get:

```
src/generated/
  types.ts       # argument/option interfaces, exit code unions, result types
  commands.ts    # typed CLI execution wrappers
  schemas.ts     # JSON Schema constants and exit code arrays
  program.ts     # Commander program definition (createProgram + CommandHandlers + --introspect)
  policy.ts      # deterministic policy derivation engine (when effects are declared)
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
        effects:
          riskLevel: high
          requiresConfirmation: true
          writes:
            - target: "user database"
              description: "Writes imported users to the database"
              idempotent: false
        x-agent:
          recommendedBeforeUse:
            - Validate the CSV schema.
            - Run with --dry-run before actual import.

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
| `artifactSlots` | No | Named artifact slots declaring what the tool reads/writes at an abstract level |
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
| `x-stdin` | No | Declares stdin policy for the command set (e.g. no command reads from stdin) |

### Command fields

| Field | Required | Description |
|---|:---:|---|
| `summary` | Yes | Short description |
| `description` | No | Long description |
| `path` | No | CLI subcommand path override. Defaults to ID with `.` replaced by spaces |
| `usage` | No | Human-readable usage examples |
| `arguments` | No | Positional arguments |
| `options` | No | Named options and flags |
| `effects` | No | Base execution effects (always active regardless of options) |
| `constraints` | No | Input constraints (`mutuallyExclusive`, `requiredOneOf`) |
| `streams` | No | stdin/stdout/stderr contracts during execution |
| `signals` | No | OS signals the command handles |
| `exits` | Yes | Exit-code keyed output contracts |
| `examples` | No | Usage examples |
| `x-agent` | No | AI agent supplementary metadata (non-derivable info only) |

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
| `effects` | No | Execution effects triggered when the option is active |
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
| `format` | Yes | `json`, `yaml`, `text`, `ndjson`, `table`, etc. Can be a dynamic expression (e.g. `'{options.report-format}'`) |
| `required` | No | Whether this output is required (default: `true` when defined) |
| `schema` | No | JSON Schema or `$ref` for the output |
| `schemaNote` | No | Clarification about when the schema applies (e.g. conditional on an option) |
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

### Artifact Slots

`artifactSlots` declares what a tool reads and writes at an abstract level, without referencing any specific project artifact. Each slot has a name, optional description, and a direction (`read`, `write`, or `readwrite`).

```yaml
artifactSlots:
  spec-source:
    description: "Specification files to lint/verify"
    direction: read
  design-models:
    description: "Design model definitions"
    direction: read
  implementation-source:
    description: "Source code for annotation/traceability check"
    direction: read
  generated-output:
    description: "Files generated from models"
    direction: write
```

| Field | Required | Description |
|---|:---:|---|
| `description` | No | What this slot represents |
| `direction` | Yes | `read`, `write`, or `readwrite` |

Slots are domain-agnostic. The binding of slots to concrete project artifacts is handled by `artifact_bindings` in agent-contracts, not in cli-contracts.

When `artifactSlots` is declared, command effects can reference slot names instead of free-text targets:

```yaml
commands:
  lint:
    effects:
      reads: [spec-source, design-models]
      writes: []
  build:
    effects:
      reads: [spec-source, design-models]
      writes: [generated-output]
```

The validator checks that slot references in `effects.reads` / `effects.writes` exist in the document-level `artifactSlots`. Referencing an undefined slot produces a validation error.

### Effects

Commands and options can declare execution effects. Effects support two formats for `reads` and `writes`:

- **Slot references** (string array) — references to `artifactSlots` entries, used when slots are declared
- **Descriptive objects** (object array) — free-text targets with metadata, used when slots are not declared

Slot reference format:

```yaml
effects:
  reads: [spec-source, design-models]
  writes: [generated-output]
```

Descriptive object format:

```yaml
effects:
  riskLevel: high
  requiresConfirmation: true
  writes:
    - target: "user database"
      description: "Writes imported users to the database"
      idempotent: false
  network:
    description: "Calls external LLM API"
    domains: ["api.openai.com"]
    idempotent: true
    idempotencyKey: "request hash"
```

### Extensions (`x-*`)

Properties prefixed with `x-` carry domain-specific metadata. The `x-agent` extension provides non-derivable agent-facing supplementary information:

```yaml
x-agent:
  expectedDurationMs: 60000
  retryableExitCodes: [1, 12]
  recommendedBeforeUse:
    - Validate the CSV schema.
    - Run with --dry-run before actual import.
  rollback:
    strategy: "git checkout"
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
| `cli-contracts diff [old] [new]` | Detect breaking changes between versions |
| `cli-contracts extract` | Extract a subset of the contract for specific commands |
| `cli-contracts propose-agent-policy [contract]` | Detect missing or inconsistent `x-agent` policies via LLM |
| `cli-contracts audit [contract]` | Semantic audit of CLI contract design quality |
| `cli-contracts propose-tests [contract]` | Propose contract test cases via LLM analysis |
| `cli-contracts explain-diff [old] [new]` | Explain contract diff in human- and agent-readable form |
| `cli-contracts check-reference [contract]` | Check LLM command conformance against the reference specification |
| `cli-contracts suggest` | Generate a contract draft from existing CLI sources |

### Global options

| Option | Alias | Description |
|---|---|---|
| `--config <file>` | `-c` | Path to `cli-contracts.config.yaml` |
| `--verbose` | `-v` | Enable verbose output |
| `--format <format>` | `-F` | Output format for core commands (`yaml` or `json`). Does not apply to LLM commands which use `--report-format` |
| `--quiet` | `-q` | Suppress informational/verbose output only. Does not suppress primary structured stdout |
| `--introspect` | | Output derived execution policy as JSON without executing the command (generated when effects are declared) |
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
| `[old]` | Path to the old contract file (can be omitted when using `--base`/`--head`) |
| `[new]` | Path to the new contract file (can be omitted when using `--base`/`--head`) |

| Option | Alias | Default | Description |
|---|---|---|---|
| `--base <ref>` | | | Git ref for the base version (e.g. `main`, `v1.0.0`) |
| `--head <ref>` | | | Git ref for the head version (e.g. `HEAD`, `feature-branch`) |
| `--contract-path <path>` | `-p` | `cli-contract.yaml` | Contract file path within the repository (used with `--base`/`--head`) |
| `--breaking-only` | | `false` | Only report breaking changes |
| `--text` | | `false` | Output human-readable text instead of structured data. Disables schema-conformant output |

### propose-agent-policy

| Argument | Description |
|---|---|
| `[contract]` | Contract file to analyze (mutually exclusive with `--file`) |

| Option | Default | Description |
|---|---|---|
| `--file <file>` | `-f` | Contract file to analyze (alternative to positional argument) |
| `--adapter <name>` | | LLM adapter (`mock`, `cursor`, `claude`, `openai`, `gemini`) |
| `--model <name>` | | Model name to pass to the adapter |
| `--show-prompt` | `false` | Output the constructed prompt without calling the LLM API |
| `--fail-on <level>` | `error` | Minimum severity that causes a non-zero exit (`warning`, `error`, `critical`) |
| `--output <file>` | | Write result to a file instead of stdout |
| `--report-format <fmt>` | `json` | Output format (`json`, `text`, or `yaml`) |

### audit

| Argument | Description |
|---|---|
| `[contract]` | Contract file to audit (mutually exclusive with `--file`) |

| Option | Default | Description |
|---|---|---|
| `--file <file>` | `-f` | Contract file to audit (alternative to positional argument) |
| `--checks <check...>` | all | Audit dimension(s) to run (`agent-policy`, `responsibility`, `exit-code`, `output-schema`, `breaking-risk`) |
| `--adapter <name>` | | LLM adapter (`mock`, `cursor`, `claude`, `openai`, `gemini`) |
| `--model <name>` | | Model name to pass to the adapter |
| `--show-prompt` | `false` | Output the constructed prompt without calling the LLM API |
| `--fail-on <level>` | `error` | Minimum severity that causes a non-zero exit |
| `--output <file>` | | Write result to a file instead of stdout |
| `--report-format <fmt>` | `json` | Output format (`json`, `text`, or `yaml`) |

### propose-tests

| Argument | Description |
|---|---|
| `[contract]` | Contract file to analyze (mutually exclusive with `--file`) |

| Option | Default | Description |
|---|---|---|
| `--file <file>` | `-f` | Contract file to analyze (alternative to positional argument) |
| `--adapter <name>` | | LLM adapter (`mock`, `cursor`, `claude`, `openai`, `gemini`) |
| `--model <name>` | | Model name to pass to the adapter |
| `--show-prompt` | `false` | Output the constructed prompt without calling the LLM API |
| `--fail-on <level>` | `error` | Minimum severity that causes a non-zero exit |
| `--output <file>` | | Write result to a file instead of stdout |
| `--report-format <fmt>` | `json` | Output format (`json`, `text`, or `yaml`) |

### explain-diff

| Argument | Description |
|---|---|
| `[old]` | Path to the old (base) contract file |
| `[new]` | Path to the new (head) contract file |

| Option | Default | Description |
|---|---|---|
| `--base <ref>` | | Git ref for the base version |
| `--head <ref>` | | Git ref for the head version |
| `--contract-path <path>` | `cli-contract.yaml` | Contract file path within the repository (used with `--base`/`--head`) |
| `--adapter <name>` | | LLM adapter (`mock`, `cursor`, `claude`, `openai`, `gemini`) |
| `--model <name>` | | Model name to pass to the adapter |
| `--show-prompt` | `false` | Output the constructed prompt without calling the LLM API |
| `--fail-on <level>` | `error` | Minimum severity that causes a non-zero exit |
| `--output <file>` | | Write result to a file instead of stdout |
| `--report-format <fmt>` | `json` | Output format (`json`, `text`, or `yaml`) |

### suggest

At least one `--from-*` option is required.

| Option | Default | Description |
|---|---|---|
| `--from-readme <file>` | | Path to a README file to extract CLI information from |
| `--from-help <file>` | | Path to a file containing `--help` output |
| `--from-source <file>` | | Path to CLI source code file |
| `--adapter <name>` | | LLM adapter (`mock`, `cursor`, `claude`, `openai`, `gemini`) |
| `--model <name>` | | Model name to pass to the adapter |
| `--show-prompt` | `false` | Output the constructed prompt without calling the LLM API |
| `--fail-on <level>` | `error` | Minimum severity that causes a non-zero exit (`warning`, `error`, `critical`) |
| `--output <file>` | | Write result to a file instead of stdout |
| `--report-format <fmt>` | `json` | Output format (`json`, `text`, or `yaml`) |

### check-reference

Verifies whether LLM-powered commands in a target `cli-contract.yaml` conform to the cli-contracts reference specification. Performs deterministic pre-analysis (option presence, exit code coverage, schema structure, x-agent metadata) and uses LLM for semantic evaluation of overall conformance quality.

| Argument | Description |
|---|---|
| `[contract]` | Contract file to check (mutually exclusive with `--file`) |

| Option | Default | Description |
|---|---|---|
| `--file <file>` / `-f` | | Contract file to check (alternative to positional argument) |
| `--adapter <name>` | | LLM adapter (`mock`, `cursor`, `claude`, `openai`, `gemini`) |
| `--model <name>` | | Model name to pass to the adapter |
| `--show-prompt` | `false` | Output the constructed prompt without calling the LLM API |
| `--fail-on <level>` | `error` | Minimum severity that causes a non-zero exit (`warning`, `error`, `critical`) |
| `--output <file>` | | Write result to a file instead of stdout |
| `--report-format <fmt>` | `json` | Output format (`json`, `text`, or `yaml`) |

Conformance checks include:

- Standard LLM option set (`--adapter`, `--model`, `--show-prompt`, `--fail-on`, `--output`, `--report-format`)
- Exit code coverage (0, 1, 10, 11, 12)
- `x-agent` metadata (`safeDryRunOption`, `sideEffectNote`, `expectedDurationMs`, `retryableExitCodes`)
- Stdout schema conformance to the agent-contracts canonical `agent-audit-result` / `agent-finding` schema (via `$ref` or compatible inline definition)
- `agent-evidence` base property alignment (`kind`, `target`, `location`, `excerpt`)
- `agent-recommended-action` property alignment (`kind`, `title`, `command`, `target`, `rationale`)
- Deprecated inline handoff schema detection (`x-schema-source: handoff`)

For full details on every command, option, exit code, and output schema, see the [CLI Reference](docs/cli-reference.md).

## Generators

Generated code is intended to keep the CLI interface aligned with the contract. Business logic remains in your application code.

### TypeScript (`builtin:typescript`)

Generates typed interfaces, command wrappers, a Commander program definition, and a policy derivation engine from the contract.

```
src/generated/
  index.ts       # re-exports
  types.ts       # argument/option interfaces, exit code unions, result types
  commands.ts    # typed CLI execution wrappers
  schemas.ts     # JSON Schema constants and exit code arrays
  program.ts     # Commander program definition (createProgram + CommandHandlers + --introspect)
  policy.ts      # deterministic policy derivation engine (when effects are declared)
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

Contract tests verify that a real CLI implementation conforms to the contract by executing the actual command and checking its outputs.

Each test case:

- Invokes the real command via an execution profile
- Asserts the exit code
- Validates stdout/stderr against JSON Schema when a schema is declared
- Checks file outputs for existence, media type, and schema when file contracts are declared
- Supports `absent: true` to assert that a stream produces no output
- Respects configurable timeout and working directory per profile

Non-JSON output formats (text, table, ndjson) are validated at the format level; deep schema validation applies to JSON and YAML outputs.

Test cases are YAML files:

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

## AI Agent Interoperability Reference

CLI Contracts provides a layered approach to AI agent interoperability: **effect declarations** for deterministic policy derivation, **runtime introspection** for pre-execution queries, and **`x-agent`** for non-derivable supplementary metadata.

### Effect Declarations

Effects declare what a command does to the outside world. They can be placed at command level (always active) or option level (active only when the option is specified):

```yaml
lint:
  options:
    - name: fix
      schema: { type: boolean }
      effects:
        riskLevel: medium
        writes:
          - target: "source files matching lint rules"
            description: "auto-fix lint violations"
            overwrite: true
            idempotent: true
            idempotentNote: "same lint rules + same input = no additional changes on re-run"

build:
  effects:
    riskLevel: low
    writes:
      - target: "docs/, specs/"
        description: "files generated from models"
        idempotent: true
```

| Field | Type | Description |
|---|---|---|
| `riskLevel` | `low` \| `medium` \| `high` \| `critical` | Risk level contributed by this command/option |
| `writes` | `string[]` \| `EffectWrite[]` | Slot references or descriptive write side effects |
| `reads` | `string[]` \| `EffectRead[]` | Slot references or descriptive read side effects |
| `network` | `boolean` \| `NetworkEffect` | Network call side effects |
| `executionMode` | `normal` \| `long-running` \| `watch` \| `interactive` \| `background` | Execution mode |
| `requiresConfirmation` | `boolean` | Explicit override for confirmation requirement |

`EffectWrite` fields:

| Field | Type | Description |
|---|---|---|
| `target` | `string` | Description of what is written |
| `description` | `string` | Details about the write operation |
| `overwrite` | `boolean` | Whether existing files may be overwritten |
| `destructive` | `boolean` | Whether the write is destructive |
| `idempotent` | `boolean` | Whether this write is idempotent |
| `idempotencyKey` | `string` | Key that determines idempotency |
| `idempotentNote` | `string` | Clarification about idempotency |

`NetworkEffect` fields:

| Field | Type | Description |
|---|---|---|
| `description` | `string` | Description of the network call |
| `domains` | `string[]` | Target domains |
| `requiresSecrets` | `string[]` | Required secret environment variables |
| `idempotent` | `boolean` | Whether this network call is idempotent |
| `idempotencyKey` | `string` | Key that determines idempotency |
| `idempotentNote` | `string` | Clarification about idempotency |

### Runtime Introspection (`--introspect`)

When a contract declares effects, the code generator adds a `--introspect` global option. It returns derived policy as JSON without executing the command:

```bash
$ tool lint --fix --introspect
{
  "command": "lint",
  "activeOptions": ["fix"],
  "policy": {
    "riskLevel": "medium",
    "requiresConfirmation": false,
    "sideEffects": ["file_write"],
    "reads": [],
    "writes": [
      {
        "kind": "semantic",
        "target": "source files matching lint rules",
        "description": "auto-fix lint violations",
        "idempotent": true,
        "source": "option:fix"
      }
    ],
    "idempotent": true
  }
}
```

Policy derivation rules:
- `riskLevel` = `max(command.riskLevel, ...activeOptions.riskLevel)`
- `requiresConfirmation` = `true` when `riskLevel >= high` (with explicit override)
- `sideEffects` = union of `file_write` (from writes/file.mode) and `network` (from network effects)
- `idempotent` = `true` only if all semantic writes AND all network effects are explicitly `idempotent: true`; implicitly `true` for read-only commands

### `x-agent`: Supplementary Agent Metadata

The `x-agent` extension carries non-derivable, agent-facing metadata. Fields that overlap with `effects` are deprecated:

```yaml
x-agent:
  recommendedBeforeUse:
    - Run without --fix first to review issues
  rollback:
    strategy: "git checkout"
  humanReview:
    required: true
    reason: "destructive operation"
  expectedDurationMs: 120000
  retryableExitCodes: [1, 12]
```

| Field | Type | Description |
|---|---|---|
| `recommendedBeforeUse` | `string[]` | Steps an agent should take before executing |
| `rollback` | `object` | Rollback instructions |
| `humanReview` | `object` | Human review requirements |
| `expectedDurationMs` | `number` | Expected wall-clock time |
| `retryableExitCodes` | `number[]` | Exit codes safe to retry |
| `preferAlternative` | `string` | Suggested alternative command |

**Deprecated `x-agent` fields** (use `effects` instead):

| Deprecated Field | Replacement |
|---|---|
| `riskLevel` | `effects.riskLevel` + max aggregation |
| `sideEffects` | `effects.writes` / `effects.network` + `file.mode` |
| `sideEffectNote` | `effects.writes[].description` |
| `requiresConfirmation` | `effects.requiresConfirmation` or derived from `riskLevel >= high` |
| `requiresConfirmationWhen` | Option-level `effects.riskLevel` |
| `dangerousOptions` | Option-level `effects.riskLevel` |
| `safeDryRunOption` | Replaced by `--introspect` |
| `requiresNetwork` | `effects.network` |
| `requiresSecrets` | `env[].sensitive` |
| `reads` / `writes` | `effects.reads` / `effects.writes` + `file.mode` |
| `idempotent` | `effects.writes[].idempotent` / `effects.network.idempotent` |
| `idempotentNote` | `effects.writes[].idempotentNote` / `effects.network.idempotentNote` |

Validation produces warnings when deprecated fields are used alongside `effects` declarations.

Options can also carry `x-agent` metadata:

```yaml
options:
  - name: text
    x-agent:
      disablesStructuredOutput: true
```

### Handoff Schema Ownership

Handoff schemas for agent-facing diagnostic output are canonically owned by agent-contracts. The canonical schemas are `agent-audit-result`, `agent-finding`, `agent-recommended-action`, and `agent-evidence`, defined in agent-contracts `components.schemas`.

When a CLI command returns a payload intended to be consumed as an agent handoff, cli-contracts should reference the agent-contracts schema via `$ref` instead of redefining the schema in `components.schemas`. cli-contracts remains responsible for the CLI interface contract, including command arguments, options, exit codes, stdout/stderr formats, and any CLI-specific envelope schema.

For backward compatibility, `AgentAuditResult`, `AgentFinding`, `AgentRecommendedAction`, and `AgentEvidence` are still available in `cli-contract.yaml` `components/schemas` and exported via the `cli-contracts/agent` subpath, but they are marked as deprecated (`x-deprecated: true`). New projects should reference agent-contracts schemas directly.

```typescript
import type { AgentAuditResult, AgentFinding } from "cli-contracts/agent";
import { XAgentSchema, validateXAgent } from "cli-contracts/agent";
```

`AgentAuditResult` (canonical: `agent-contracts:components.schemas.agent-audit-result`) is the standard output format for LLM-backed audit commands across the toolchain:

```typescript
interface AgentAuditResult {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  findings: AgentFinding[];
  recommendedActions?: AgentRecommendedAction[];
  metadata?: { tool?: string; command?: string; version?: string; ... };
}
```

`AgentFinding` (canonical: `agent-contracts:components.schemas.agent-finding`):

```typescript
interface AgentFinding {
  severity: "info" | "warning" | "error" | "critical";
  category: string;
  message: string;
  id?: string;
  target?: string;
  location?: string;
  recommendation?: string;
  confidence?: number;  // 0–1
  evidence?: AgentEvidence[];
}
```

`AgentEvidence` (canonical: `agent-contracts:components.schemas.agent-evidence`):

```typescript
interface AgentEvidence {
  kind: "file" | "command" | "schema" | "diff" | "stdout" | "stderr" | "text";
  target?: string;    // source identifier (file path, command ID, schema name)
  location?: string;  // location within the target (line number, JSON pointer)
  excerpt?: string;   // relevant content excerpt
}
```

`AgentRecommendedAction` (canonical: `agent-contracts:components.schemas.agent-recommended-action`):

```typescript
interface AgentRecommendedAction {
  kind: "run_command" | "edit_file" | "review" | "confirm" | "block" | "ignore";
  title: string;
  command?: string;
  target?: string;
  rationale?: string;
}
```

### LLM-Backed Commands

Six commands use LLM integration via `agent-contracts-runtime` (optional peer dependency) to perform semantic analysis:

| Command | Purpose |
|---|---|
| `propose-agent-policy` | Detect missing or inconsistent `x-agent` policies |
| `audit` | Semantic audit of contract design quality |
| `propose-tests` | Generate test case proposals from contract definitions |
| `explain-diff` | Generate human-readable explanations of contract diffs |
| `check-reference` | Verify LLM command conformance against the reference specification |
| `suggest` | Draft a contract from existing CLI sources (README, --help, source code) |

```bash
# Propose x-agent policies for commands missing them
cli-contracts propose-agent-policy cli-contract.yaml --adapter gemini

# Audit contract design quality
cli-contracts audit cli-contract.yaml --checks agent-policy --adapter claude

# Propose test cases
cli-contracts propose-tests cli-contract.yaml --adapter openai --report-format yaml

# Explain a diff between contract versions
cli-contracts explain-diff old.yaml new.yaml --adapter gemini

# Check LLM command conformance against the reference specification
cli-contracts check-reference path/to/cli-contract.yaml --adapter openai

# Generate a contract draft from an existing README
cli-contracts suggest --from-readme README.md --adapter cursor

# Inspect the prompt without making an LLM call
cli-contracts propose-agent-policy cli-contract.yaml --show-prompt
```

These commands share a common option interface:

| Option | Description |
|---|---|
| `--adapter <name>` | LLM adapter: `mock`, `cursor`, `claude`, `openai`, `gemini` |
| `--model <name>` | Model name to pass to the adapter |
| `--show-prompt` | Output the constructed prompt without calling the LLM API |
| `--fail-on <level>` | Minimum severity that causes a non-zero exit (`warning`, `error`, `critical`) |
| `--output <file>` | Write result to a file instead of stdout |
| `--report-format <fmt>` | Output format: `json`, `text`, or `yaml` |

All LLM commands declare `effects.network` for their API calls, with `expectedDurationMs: 120000` and `retryableExitCodes: [1, 12]` in `x-agent`.

Install the optional runtime dependency to enable LLM calls:

```bash
npm install agent-contracts-runtime
```

Without it, use `--show-prompt` to inspect the prompt context that would be sent to the LLM.

Required environment variables depend on the chosen adapter:

| Adapter | Environment Variable |
|---|---|
| `cursor` | `CURSOR_API_KEY` |
| `gemini` | `GEMINI_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `claude` | `ANTHROPIC_API_KEY` |

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
- LLM-backed semantic audit, test case generation, and contract drafting

OpenCLI primarily describes how a CLI is invoked. CLI Contracts describes how a CLI behaves as an interface.

OpenCLI is closest to a description format. CLI Contracts is closer to a contract lifecycle toolchain.

The goal is not to compete with OpenCLI as a standard, but to provide a practical toolchain for teams that need stronger guarantees around CLI compatibility, automation, and AI-agent execution policies.

## CLI Contracts vs OpenCLI

OpenCLI is a description format. CLI Contracts is a contract lifecycle toolchain.

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
| LLM-backed audit | Not applicable | Built-in semantic audit, test proposal, and contract generation via LLM |
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

Currently supports a practical subset of JSON Schema. Full dialect compatibility (targeting draft 2020-12) will be finalized before 1.0. The contract format itself is validated using Zod, and machine-readable JSON Schema files for the contract and config formats are published in the `schemas/` directory:

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

CLI Contracts is currently pre-1.0. The current contract format version is `0.1.0`.

Until 1.0:

- The contract format may change based on feedback.
- Breaking format changes will be documented in release notes.
- Migration guidance will be provided when possible.
- The `diff` command is intended to help detect compatibility impact between contract versions, but does not guarantee automatic migration.

## License

MIT
