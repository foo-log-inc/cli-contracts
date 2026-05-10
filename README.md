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

CLI Contracts can also provide AI-agent execution policies — side effects, risk levels, confirmation requirements, idempotency, and safe dry-run options — through the `x-agent` extension, so that agents can make informed safety decisions.

## What it does

Use the same contract to:

- **Define** commands, arguments, options, exit codes, stdout/stderr schemas, files, and streams in a single YAML contract
- **Validate** contracts for structural correctness, duplicate IDs, invalid refs, and exit code consistency
- **Generate** TypeScript types, CLI wrappers, Markdown documentation, and custom output via Handlebars templates
- **Test** real CLI implementations against the contract
- **Diff** contract versions to detect breaking changes before release
- **Declare AI-agent execution policies** — risk level, side effects, idempotency, confirmation, and safe dry-run options via `x-agent`
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
| `constraints` | No | Input constraints (`mutuallyExclusive`, `requiredOneOf`) |
| `streams` | No | stdin/stdout/stderr contracts during execution |
| `signals` | No | OS signals the command handles |
| `exits` | Yes | Exit-code keyed output contracts |
| `examples` | No | Usage examples |
| `x-agent` | No | AI agent execution policy |

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

### Extensions (`x-*`)

Properties prefixed with `x-` carry domain-specific metadata. The `x-agent` extension describes AI agent execution policy:

```yaml
x-agent:
  riskLevel: high
  requiresConfirmation: true
  idempotent: false
  sideEffects: [database_write]
  safeDryRunOption: dry-run
  sideEffectNote: Writes to the user database.
  dangerousOptions: [force]
  expectedDurationMs: 60000
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
| `--dry-run` | `false` | Output prompt context without making an LLM call |
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
| `--dry-run` | `false` | Output prompt context without making an LLM call |
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
| `--dry-run` | `false` | Output prompt context without making an LLM call |
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
| `--dry-run` | `false` | Output prompt context without making an LLM call |
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
| `--dry-run` | `false` | Output prompt context without making an LLM call |
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
| `--dry-run` | `false` | Output prompt context without making an LLM call |
| `--fail-on <level>` | `error` | Minimum severity that causes a non-zero exit (`warning`, `error`, `critical`) |
| `--output <file>` | | Write result to a file instead of stdout |
| `--report-format <fmt>` | `json` | Output format (`json`, `text`, or `yaml`) |

Conformance checks include:

- Standard LLM option set (`--adapter`, `--model`, `--dry-run`, `--fail-on`, `--output`, `--report-format`)
- Exit code coverage (0, 1, 10, 11, 12)
- `x-agent` metadata (`safeDryRunOption`, `sideEffectNote`, `expectedDurationMs`, `retryableExitCodes`)
- Stdout schema conformance to `AgentAuditResult` / `AgentFinding` shape
- `AgentEvidence` base property alignment

For full details on every command, option, exit code, and output schema, see the [CLI Reference](docs/cli-reference.md).

## Generators

Generated code is intended to keep the CLI interface aligned with the contract. Business logic remains in your application code.

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

CLI Contracts provides two sets of reference specifications for AI agent interoperability. These are not mandatory standards, but shared conventions that toolchains can adopt for uniform agent integration.

### `x-agent`: Pre-Execution Policy

The `x-agent` extension on commands declares execution policies that AI agents can read before running a command. It is formalized with a typed Zod schema (`XAgentSchema`) and validated during `cli-contracts validate`:

```yaml
x-agent:
  riskLevel: high             # low | medium | high | critical
  requiresConfirmation: true
  requiresConfirmationWhen: [clean]
  idempotent: true
  idempotentNote: >-
    Idempotent for final state; --clean creates a transient
    destructive intermediate state.
  sideEffects: [filesystem, network]
  sideEffectNote: >-
    Network calls to LLM provider when adapter is not mock.
    Filesystem write only when --output is specified.
  safeDryRunOption: dry-run
  dangerousOptions: [clean]
  expectedDurationMs: 120000
  retryableExitCodes: [1, 12]
  recommendedBeforeUse:
    - Run with --dry-run before actual import.
```

| Field | Type | Description |
|---|---|---|
| `riskLevel` | `low` \| `medium` \| `high` \| `critical` | Risk classification for the command |
| `requiresConfirmation` | `boolean` | Whether agent should ask for user confirmation |
| `requiresConfirmationWhen` | `string[]` | Options that trigger confirmation even if `requiresConfirmation` is `false` |
| `idempotent` | `boolean` | Whether repeated execution produces the same result |
| `idempotentNote` | `string` | Clarifications or caveats about idempotency |
| `sideEffects` | `string[]` | Categories of side effects (e.g. `filesystem`, `network`, `process-execution`) |
| `sideEffectNote` | `string` | Details about when/how side effects occur |
| `safeDryRunOption` | `string` | Option that enables a safe dry-run mode |
| `dangerousOptions` | `string[]` | Options that significantly increase risk |
| `expectedDurationMs` | `number` | Expected wall-clock time for the command |
| `retryableExitCodes` | `number[]` | Exit codes that are safe to retry |
| `preferAlternative` | `string` | Suggested alternative command when applicable |
| `recommendedBeforeUse` | `string[]` | Steps an agent should take before executing |

Validation rules:

- `riskLevel` of `high` or `critical` without `requiresConfirmation: true` produces a warning
- `sideEffects` present without `idempotent` declared produces a warning
- Extended fields (`executionMode`, `reads`, `writes`, `requiresNetwork`, `requiresSecrets`, `humanReview`, `rollback`) are accepted via passthrough

Options can also carry `x-agent` metadata:

```yaml
options:
  - name: text
    x-agent:
      disablesStructuredOutput: true
```

### Agent Response Reference Schemas

`AgentFinding`, `AgentAuditResult`, `AgentRecommendedAction`, and `AgentEvidence` are reference schemas for agent-facing diagnostic output, defined in `cli-contract.yaml` `components/schemas` and exported via the `cli-contracts/agent` subpath:

```typescript
import type { AgentAuditResult, AgentFinding } from "cli-contracts/agent";
import { XAgentSchema, validateXAgent } from "cli-contracts/agent";
```

`AgentAuditResult` is the standard output format for LLM-backed audit commands across the toolchain:

```typescript
interface AgentAuditResult {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  findings: AgentFinding[];
  recommendedActions?: AgentRecommendedAction[];
  metadata?: { tool?: string; command?: string; version?: string; ... };
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
cli-contracts propose-agent-policy cli-contract.yaml --dry-run
```

These commands share a common option interface:

| Option | Description |
|---|---|
| `--adapter <name>` | LLM adapter: `mock`, `cursor`, `claude`, `openai`, `gemini` |
| `--model <name>` | Model name to pass to the adapter |
| `--dry-run` | Output the prompt context without making an LLM call |
| `--fail-on <level>` | Minimum severity that causes a non-zero exit (`warning`, `error`, `critical`) |
| `--output <file>` | Write result to a file instead of stdout |
| `--report-format <fmt>` | Output format: `json`, `text`, or `yaml` |

All LLM commands declare `sideEffects: [network]` in their `x-agent` policy, with `expectedDurationMs: 120000` and `retryableExitCodes: [1, 12]`.

Install the optional runtime dependency to enable LLM calls:

```bash
npm install agent-contracts-runtime
```

Without it, use `--dry-run` to inspect the prompt context that would be sent to the LLM.

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
