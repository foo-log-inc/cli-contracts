# CLI Contracts Specification Draft

Version: 0.1.0-draft  
Positioning: OpenAPI-like contract specification for command line interfaces  
Primary artifact: `cli-contract.yaml`  
Companion config: `cli-contracts.config.yaml`  
Tool name: `cli-contracts`  
Relationship to OpenCLI: independent native schema; OpenCLI export is optional tooling, not core specification

---

## 1. Purpose

CLI Contracts is a contract-first specification for command line interfaces.

It defines how one or more CLI command sets are invoked, what inputs they accept, what files they read or write, how they behave with streams and pipes, what each exit code means, and what each exit code may emit to `stdout`, `stderr`, or generated files.

The goal is to make CLI tools contract-first in the same sense that OpenAPI makes HTTP APIs contract-first.

CLI Contracts is intended for:

- CLI interface definition
- contract review between CLI users and implementers
- machine-readable command documentation
- validator generation
- TypeScript and Rust code generation
- custom code generation through Handlebars templates
- contract tests against real CLI implementations
- AI agent tool definition and safety policy (via `x-agent` extension)
- compatibility and breaking-change checks between versions

CLI Contracts is not intended to define internal implementation logic.

---

## 2. Naming convention

Recommended project naming:

| Item | Name |
|---|---|
| Project | CLI Contracts |
| npm package | `cli-contracts` |
| CLI command | `cli-contracts` |
| Specification | CLI Contracts Specification |
| Contract file | `cli-contract.yaml` |
| Config file | `cli-contracts.config.yaml` |
| Multiple contract directory | `cli-contracts/` |

The plural form matches related ecosystems such as `micro-contracts` and `agent-contracts`.

---

## 3. Relationship to OpenCLI

OpenCLI already exists as an early CLI description specification. CLI Contracts should not reuse the OpenCLI name.

CLI Contracts does not use OpenCLI as its internal schema. OpenCLI export is not part of the core specification, but may be provided by tooling as an optional compatibility generator. The key design differences are:

```text
CLI Contracts                          OpenCLI
─────────────────────────────────────  ──────────────────────────────
commands is a map (stable IDs)         commands is a nested tree
path derived from command ID            path is implicit from nesting
exits keyed by exit code               exitCodes is a flat list
stdout/stderr/files per exit code      no per-exit-code output contract
streams are first-class                no stream model
file contracts on args/options         no file contract model
x-agent extension (risk, side effects) no agent model
components with $ref (JSON Schema)     no shared component system
```

CLI Contracts shares the goal of describing CLI interfaces in a machine-readable way, but takes an OpenAPI-inspired approach with richer exit contracts, file I/O, stream modeling, and extensibility (including AI-agent metadata via `x-agent`) that OpenCLI does not cover.

---

## 4. Design principles

1. **Contract first**  
   `cli-contract.yaml` is the canonical source of truth.

2. **Multiple command sets**  
   A single contract file can define multiple independent CLI executables or command groups.

3. **Commands are a map**  
   `commandSets.<setId>.commands` is a map keyed by stable command IDs.

4. **Command path defaults to ID**  
   The CLI subcommand path is derived by replacing `.` in the command ID with spaces. Combined with the executable name (from `executable` field, or the command set key when omitted), `users.import` in a command set with executable `foo` becomes `foo users import`. An explicit `path` can override this when the CLI syntax differs from the ID.

5. **Exit-code keyed output contracts**  
   CLI results are described by `exits.<exitCode>`.

6. **Exit codes are first-class**  
   Exit code definitions are not only a list. They are first-class output contracts with stdout, stderr, and files.

7. **Structured stdout and stderr**  
   `stdout` and `stderr` can be specified independently for each exit code.

8. **Files are first-class**  
   Input files, output files, and generated files can have media types, encodings, and schemas.

9. **Streams are first-class**  
   All standard I/O (stdin, stdout, stderr) during execution is modeled under `streams`. Output that is determined at exit is modeled under `exits`.

10. **JSON Schema compatible**  
    Data schemas should be JSON Schema compatible where possible.

11. **Template-based generation**  
    Generators are based on Handlebars templates and can be extended to multiple languages.

12. **Extensible via `x-*` properties**  
    Extension properties prefixed with `x-` are allowed on command sets, commands, and other objects. They carry domain-specific metadata without polluting the core schema.

13. **Runtime execution is config, not contract**  
    Physical binary paths, Docker invocation, `npx` invocation, environment variables, and test execution settings belong in `cli-contracts.config.yaml` unless they are part of the user-facing interface.

---

## 5. Terminology

| Term | Meaning |
|---|---|
| CLI Contracts document | The contract file, usually `cli-contract.yaml` |
| command set | A logical CLI executable or independently managed command group |
| executable | User-facing command name, such as `foo` or `foo-admin` |
| command ID | Stable identifier in the contract, such as `users.import` |
| command path | CLI subcommand sequence, derived from command ID by replacing `.` with spaces (e.g. `users.import` → `users import`) |
| argument | Positional parameter |
| option | Named flag or option, such as `--config` |
| exit | Output contract associated with an exit code |
| stream | Continuous pipe-based input/output |
| file parameter | Argument or option whose value points to a file |
| generated file | File produced by command execution |
| execution profile | Environment-specific way to execute the CLI during validation or tests |
| generator | Tool that emits code, docs, tests, wrappers, or custom output |
| template | Handlebars template used by a generator |

---

## 6. Top-level document structure

```yaml
cliContracts: 0.1.0

info:
  title: Foo CLI Contracts
  version: 1.0.0
  description: Contract definitions for Foo command line tools.

commandSets:
  foo:
    summary: Main user-facing CLI.
    commands:
      users.import:
        summary: Import users from CSV.
        arguments: []
        options: []
        exits: {}

  foo-admin:
    summary: Administrative CLI.
    commands:
      tenants.create:
        summary: Create tenant.
        arguments: []
        options: []
        exits: {}

components:
  schemas: {}
```

The command set key is a stable identifier for the command set. It may match the executable name for simple cases. When `executable` is omitted, the key is used as the executable name.

### Required top-level fields

| Field | Required | Description |
|---|---:|---|
| `cliContracts` | yes | Specification version |
| `info` | yes | Metadata about this contract document |
| `commandSets` | yes | One or more CLI command sets |
| `components` | no | Shared schemas, examples, exits, and reusable definitions |

---

## 7. `info` object

```yaml
info:
  title: Foo CLI Contracts
  version: 1.0.0
  description: Contract definitions for Foo command line tools.
  license:
    name: MIT
  contact:
    name: Foo Platform Team
    url: https://example.com
```

| Field | Required | Description |
|---|---:|---|
| `title` | yes | Human-readable title |
| `version` | yes | Version of this contract document |
| `description` | no | Description |
| `license` | no | License metadata |
| `contact` | no | Contact metadata |

---

## 8. `commandSets` object

`commandSets` allows one document to define and manage multiple independent CLI executables or command groups.

```yaml
commandSets:
  foo:
    summary: Main CLI.
    commands:
      users.import:
        summary: Import users.

  foo-admin:
    summary: Admin CLI.
    commands:
      tenants.create:
        summary: Create tenant.
```

The command set key is a stable identifier for the command set. It may match the executable name for simple cases. When `executable` is omitted, the key is used as the executable name.

### `commandSets.<setId>` fields

| Field | Required | Description |
|---|---:|---|
| `executable` | no | User-facing CLI executable name. Defaults to the command set key |
| `summary` | no | Short description |
| `description` | no | Long description |
| `commands` | yes | Map of command definitions keyed by stable command ID |
| `globalOptions` | no | Options accepted by all commands in this set |
| `env` | no | Environment variables that are part of the public interface |

### Contract vs runtime environment

The following belong in the contract because they are user-facing interface:

```yaml
commandSets:
  foo:
    commands:
      users.import:
        summary: Import users from CSV.
```

The following should usually be placed in `cli-contracts.config.yaml` because they are runtime-specific:

```yaml
executionProfiles:
  local:
    commandSets:
      foo:
        command: foo
  npm:
    commandSets:
      foo:
        command: npx foo-cli
  docker:
    commandSets:
      foo:
        command: docker run --rm ghcr.io/example/foo
```

### Contract `env` vs config `env`

`env` appears in both the contract and the config, but their purposes are different:

- **Contract `commandSets.<setId>.env`**: Declares public environment variables that are part of the CLI's interface. These are environment variables that users are expected to set to control CLI behavior (e.g. `FOO_CONFIG`, `FOO_LOG_LEVEL`). They are documented, validated, and included in generated documentation.

- **Config `contractTests.env`**: Injects environment variable values for test and execution profiles. These are runtime-specific values used during testing or development (e.g. `FOO_ENV=test`). They do not appear in generated documentation.

```yaml
# Contract: declares public interface
commandSets:
  foo:
    env:
      FOO_CONFIG:
        description: Path to config file.
        schema:
          type: string

# Config: injects runtime values for testing
contractTests:
  env:
    FOO_CONFIG: ./test-config.yaml
```

---

## 9. Commands are a map

`commands` MUST be a map, not an array.

```yaml
commands:
  users.import:
    summary: Import users from CSV.

  users.export:
    summary: Export users.
```

The map key is the stable command ID. It is used for references, diffing, code generation, docs anchors, and tests.

### Path derivation

The CLI invocation is constructed from two parts:

1. **Executable**: the `executable` field, or the command set key when `executable` is omitted (e.g. `foo`)
2. **Subcommand**: the command ID with `.` replaced by spaces (e.g. `users.import` → `users import`)

```text
commandSet key: foo
command ID:     users.import  →  foo users import
command ID:     init          →  foo init
```

An explicit `path` can override the default when the CLI syntax differs from the ID:

```yaml
commands:
  legacy.user-import:
    path: [users, import]
    summary: Import users (ID differs from CLI path for backward compatibility).
```

### Why map with derived path

| Concern | Solution |
|---|---|
| Stable references | map key, e.g. `users.import` |
| CLI syntax | derived from key by default, or explicit `path` override |
| Diff friendliness | map keys are stable |
| Code generation | command IDs are stable symbol sources |
| Multiple command sets | full identity is `<commandSetId>.<commandId>` |

---

## 10. Command object

```yaml
commands:
  users.import:
    summary: Import users from a CSV file.
    description: Reads a user CSV file and imports users into the system.
    usage:
      - foo users import <input> [--dry-run]
    arguments: []
    options: []
    streams: {}
    exits: {}
    examples: []
```

| Field | Required | Description |
|---|---:|---|
| `path` | no | CLI subcommand path override. Defaults to command ID with `.` replaced by spaces |
| `summary` | yes | Short description |
| `description` | no | Long description |
| `usage` | no | Human-readable usage examples |
| `arguments` | no | Positional arguments |
| `options` | no | Command-specific options |
| `streams` | no | Stream contracts for stdin, stdout, and stderr during execution |
| `signals` | no | OS signals the command handles |
| `exits` | yes | Exit-code keyed output contracts |
| `examples` | no | Examples |
| `deprecated` | no | Deprecation metadata |

---

## 11. Arguments

```yaml
arguments:
  - name: input
    index: 0
    required: true
    description: Input CSV file.
    schema:
      type: string
    file:
      mode: read
      exists: true
      mediaType: text/csv
      encoding: utf-8
      csv:
        headerRows: 1
      schema:
        $ref: ./schemas/users.csv.schema.json
```

| Field | Required | Description |
|---|---:|---|
| `name` | yes | Argument name |
| `index` | no | Positional index. If omitted, array order is used |
| `required` | no | Whether the argument is required |
| `description` | no | Description |
| `schema` | no | JSON Schema for the argument value |
| `file` | no | File contract if the value points to a file |
| `variadic` | no | Whether the argument accepts multiple values |

---

## 12. Options

```yaml
options:
  - name: config
    aliases: [c]
    required: true
    valueName: file
    description: Configuration file.
    schema:
      type: string
    file:
      mode: read
      exists: true
      mediaType: application/yaml
      encoding: utf-8
      schema:
        $ref: ./schemas/config.schema.json

  - name: dry-run
    aliases: [n]
    description: Validate only. Do not write to the database.
    schema:
      type: boolean
      default: false
```

| Field | Required | Description |
|---|---:|---|
| `name` | yes | Long option name without `--` |
| `aliases` | no | Short aliases without `-` |
| `required` | no | Whether the option is required |
| `valueName` | no | Display name for the value |
| `description` | no | Description |
| `schema` | no | JSON Schema for the option value |
| `file` | no | File contract if the value points to a file |
| `repeatable` | no | Whether the option can be repeated |
| `deprecated` | no | Deprecation metadata |

---

## 13. File contract

File contracts can be attached to arguments or options.

```yaml
file:
  mode: read
  exists: true
  mediaType: application/json
  encoding: utf-8
  schema:
    $ref: ./schemas/input.schema.json
```

| Field | Required | Description |
|---|---:|---|
| `mode` | yes | `read`, `write`, `append`, or `readWrite` |
| `exists` | no | Whether the file must exist before execution |
| `mediaType` | no | Media type, such as `application/json`, `text/csv`, `application/yaml` |
| `encoding` | no | Encoding for text files |
| `schema` | no | Optional schema for the file content |
| `csv` | no | CSV-specific format metadata (only when `mediaType` is `text/csv`) |

`schema` is optional. If omitted, the contract specifies that the value is a file, but does not validate file content.

### CSV metadata

When a file has `mediaType: text/csv`, the `csv` field describes the physical format. The `schema` uses standard JSON Schema to describe rows as an array of objects (one object per data row, with column names as property keys).

```yaml
file:
  mode: read
  exists: true
  mediaType: text/csv
  encoding: utf-8
  csv:
    delimiter: ","
    quoteChar: "\""
    headerRows: 1
    footerRows: 0
  schema:
    $ref: ./schemas/users.csv.schema.json
```

| Field | Type | Default | Description |
|---|---|---|---|
| `delimiter` | string | `","` | Field delimiter |
| `quoteChar` | string | `"\""` | Quote character |
| `headerRows` | integer | `1` | Number of header rows (`0` = no header) |
| `footerRows` | integer | `0` | Number of footer rows to skip |

The referenced JSON Schema should describe rows as an array of objects:

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "required": ["name", "email"],
    "properties": {
      "name": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "role": { "type": "string", "enum": ["admin", "user"] }
    }
  }
}
```

### Input file example

```yaml
arguments:
  - name: input
    required: true
    schema:
      type: string
    file:
      mode: read
      exists: true
      mediaType: text/csv
      encoding: utf-8
      csv:
        headerRows: 1
      schema:
        $ref: ./schemas/users.csv.schema.json
```

### Output file option example

```yaml
options:
  - name: output
    aliases: [o]
    schema:
      type: string
    file:
      mode: write
      mediaType: application/json
      encoding: utf-8
      schema:
        $ref: '#/components/schemas/ExportResult'
```

---

## 14. Exits

`exits` is a map keyed by process exit code.

```yaml
exits:
  '0':
    description: Success.
    stdout:
      format: json
      schema:
        $ref: '#/components/schemas/ImportUsersResult'

  '2':
    description: Invalid argument or invalid input file.
    stderr:
      format: json
      schema:
        $ref: '#/components/schemas/Error'

  '10':
    description: Partial import failure.
    stdout:
      required: false
      format: json
      schema:
        $ref: '#/components/schemas/ImportUsersPartialResult'
    stderr:
      format: json
      schema:
        $ref: '#/components/schemas/Error'
```

### Exit object fields

| Field | Required | Description |
|---|---:|---|
| `description` | yes | Human-readable meaning of the exit code |
| `stdout` | no | stdout contract for this exit code |
| `stderr` | no | stderr contract for this exit code |
| `files` | no | Generated file contracts for this exit code |

### Output contract fields

```yaml
stdout:
  required: true
  format: json
  schema:
    $ref: '#/components/schemas/Result'
  examples:
    success:
      value:
        status: success
```

| Field | Required | Description |
|---|---:|---|
| `required` | no | Whether this output is required. Default is `true` when the output object is present |
| `format` | yes | `json`, `yaml`, `text`, `table`, `binary`, `ndjson`, etc. |
| `schema` | no | Schema for this output |
| `examples` | no | Named examples |

### Recommended exit rules

- If `stdout` is defined and `required` is not `false`, the implementation must emit matching stdout.
- If `stderr` is defined and `required` is not `false`, the implementation must emit matching stderr.
- If `stdout` or `stderr` is not defined for an exit code, that output should not be relied on as part of the contract.
- Undefined exit codes are outside the compatibility guarantee.
- Exit code meanings must not change in a backward-compatible release.

---

## 15. Generated files

Commands can generate files as part of their exit contract.

```yaml
exits:
  '0':
    description: Report generated.
    stdout:
      format: json
      schema:
        type: object
        required: [outputPath]
        properties:
          outputPath:
            type: string
    files:
      - path: '{stdout.outputPath}'
        required: true
        mediaType: application/json
        encoding: utf-8
        schema:
          $ref: ./schemas/report.schema.json
```

| Field | Required | Description |
|---|---:|---|
| `path` | yes | Literal path or template expression |
| `required` | no | Whether the generated file must exist |
| `mediaType` | no | File media type |
| `encoding` | no | File encoding |
| `schema` | no | Optional schema for generated file content |
| `description` | no | Description |

---

## 16. Streams

`streams` defines I/O contracts for stdin, stdout, and stderr **during execution**.

- **`streams.stdin`**: input received through standard input (both one-shot and continuous)
- **`streams.stdout`**: output emitted continuously during execution (e.g. progress, filtered events)
- **`streams.stderr`**: diagnostic output emitted during execution

`exits.*.stdout` and `exits.*.stderr` describe output **determined at exit** (e.g. final result JSON, error summary). A command may use both: `streams.stdout` for progress during execution and `exits.'0'.stdout` for the final result.

```bash
cat data.json | foo import           # one-shot stdin
tail -f app.log | foo logs filter    # continuous stdin
foo events watch | jq .              # continuous stdout
```

### One-shot stdin example

```yaml
streams:
  stdin:
    required: true
    format: json
    schema:
      $ref: '#/components/schemas/InputPayload'
```

When `framing` is absent, stdin is consumed as a single payload. When `framing` is present, stdin is processed item by item.

### Continuous stream example

```yaml
streams:
  stdin:
    required: true
    format: ndjson
    encoding: utf-8
    framing:
      type: line-delimited
      delimiter: '\n'
    itemSchema:
      $ref: '#/components/schemas/LogEvent'

  stdout:
    format: ndjson
    encoding: utf-8
    framing:
      type: line-delimited
      delimiter: '\n'
    itemSchema:
      $ref: '#/components/schemas/FilteredLogEvent'
    flush:
      policy: perItem

  stderr:
    required: false
    format: ndjson
    itemSchema:
      $ref: '#/components/schemas/DiagnosticEvent'

```

### Stream object fields

| Field | Required | Description |
|---|---:|---|
| `required` | no | Whether the stream is required. Default is `true` for `stdin` when defined, `false` for `stdout`/`stderr` |
| `format` | yes | `text-lines`, `ndjson`, `json-seq`, `csv`, `bytes`, etc. |
| `encoding` | no | Encoding for text streams |
| `framing` | no | Message boundary definition. When present, input/output is processed item by item |
| `schema` | no | Schema for the entire payload (used when `framing` is absent) |
| `itemSchema` | no | Schema for each item (used when `framing` is present) |
| `flush` | no | Flush policy |

Use `schema` for one-shot input (no `framing`). Use `itemSchema` for framed streams where each message is the contract unit.

---

## 17. Signals

`signals` declares which OS signals the command handles. It is a top-level command field alongside `streams` and `exits`.

Defining which signals a CLI accepts is part of the interface contract. However, what happens when a signal is received (e.g., graceful shutdown, exit with a specific code) is an implementation detail and should be described in `description`.

```yaml
signals:
  SIGINT:
    description: Gracefully stops processing and flushes buffered output.
  SIGTERM:
    description: Immediately terminates the process.
```

| Field | Required | Description |
|---|---:|---|
| `description` | yes | Human-readable description of how the command handles this signal |

---

## 18. Extension properties

Properties prefixed with `x-` are allowed on command sets, commands, and other objects. They carry domain-specific metadata without changing the core schema.

Validation should preserve `x-*` properties and pass them through to generators and templates.

### `x-agent`: AI agent metadata

The `x-agent` extension is a recommended profile for describing AI agent execution policy. It is not part of the core specification, but is documented here as a standard extension.

```yaml
commands:
  users.import:
    summary: Import users from CSV.
    x-agent:
      intent:
        - Import users from a CSV file.
        - Validate user CSV content.
      riskLevel: high
      requiresConfirmation: true
      idempotent: false
      sideEffects:
        - database_write
      safeDryRunOption: dry-run
      disallowAutonomousExecutionWhen:
        - environment == 'prod'
      recommendedBeforeUse:
        - Validate the input file schema.
        - Run with --dry-run before actual import.
```

| Field | Description |
|---|---|
| `intent` | Natural-language intents for tool selection |
| `riskLevel` | `low`, `medium`, `high`, or `critical` |
| `requiresConfirmation` | Whether explicit user confirmation is required |
| `idempotent` | Whether repeated execution is safe |
| `sideEffects` | Side effects such as `filesystem_write`, `database_write`, `network_call`, `deploy_application` |
| `safeDryRunOption` | Option name that enables dry-run behavior |
| `disallowAutonomousExecutionWhen` | Conditions under which autonomous execution is disallowed |
| `recommendedBeforeUse` | Checklist for agents before execution |

`x-agent` may be defined at the command set level and overridden at the command level.

---

## 19. Components

`components` contains reusable schemas and shared objects.

```yaml
components:
  schemas:
    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object
          additionalProperties: true

  examples:
    InvalidArgument:
      value:
        code: INVALID_ARGUMENT
        message: Invalid input.
```

Recommended component groups:

```yaml
components:
  schemas: {}
  examples: {}
  exits: {}
  streamItems: {}
  fileSchemas: {}
```

Schemas should be JSON Schema compatible. `$ref` may point to internal or external schemas.

---

## 20. Full example

```yaml
cliContracts: 0.1.0

info:
  title: Foo CLI Contracts
  version: 1.0.0
  description: Contract definitions for Foo command line tools.

commandSets:
  foo:
    summary: Main user-facing CLI.
    globalOptions:
      - name: verbose
        aliases: [v]
        schema:
          type: boolean
          default: false

    commands:
      users.import:
        summary: Import users from CSV.
        description: Reads a UTF-8 CSV file and imports users.
        usage:
          - foo users import <input> [--dry-run]

        arguments:
          - name: input
            index: 0
            required: true
            description: User CSV file.
            schema:
              type: string
            file:
              mode: read
              exists: true
              mediaType: text/csv
              encoding: utf-8
              csv:
                headerRows: 1
              schema:
                $ref: ./schemas/users.csv.schema.json

        options:
          - name: dry-run
            aliases: [n]
            description: Validate only. Do not write to the database.
            schema:
              type: boolean
              default: false

        exits:
          '0':
            description: Import succeeded.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/ImportUsersResult'
              examples:
                success:
                  value:
                    status: success
                    importedCount: 120

          '2':
            description: Invalid argument or invalid input file.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'

          '10':
            description: Partial import failure.
            stdout:
              required: false
              format: json
              schema:
                $ref: '#/components/schemas/ImportUsersPartialResult'
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
          recommendedBeforeUse:
            - Validate the CSV schema.
            - Run with --dry-run before actual import.

      logs.filter:
        summary: Filter log events from stdin.
        usage:
          - tail -f app.log | foo logs filter --level error

        options:
          - name: level
            schema:
              type: string
              enum: [debug, info, warn, error]
              default: error

        streams:
          stdin:
            required: true
            format: ndjson
            encoding: utf-8
            framing:
              type: line-delimited
              delimiter: '\n'
            itemSchema:
              $ref: '#/components/schemas/LogEvent'

          stdout:
            format: ndjson
            encoding: utf-8
            framing:
              type: line-delimited
              delimiter: '\n'
            itemSchema:
              $ref: '#/components/schemas/FilteredLogEvent'
            flush:
              policy: perItem

          stderr:
            required: false
            format: ndjson
            itemSchema:
              $ref: '#/components/schemas/DiagnosticEvent'

        signals:
          SIGINT:
            description: Gracefully stops filtering and flushes buffered output.
          SIGTERM:
            description: Immediately terminates the process.

        exits:
          '0':
            description: Input stream was processed successfully.
          '2':
            description: Invalid argument.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'
          '130':
            description: Interrupted by SIGINT.
          '143':
            description: Terminated by SIGTERM.

  foo-admin:
    summary: Administrative CLI.
    commands:
      tenants.create:
        summary: Create tenant.
        arguments:
          - name: name
            required: true
            schema:
              type: string
        exits:
          '0':
            description: Tenant created.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/Tenant'
          '2':
            description: Invalid argument.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    ImportUsersResult:
      type: object
      required: [status, importedCount]
      properties:
        status:
          type: string
          enum: [success]
        importedCount:
          type: integer
          minimum: 0

    ImportUsersPartialResult:
      type: object
      required: [status, importedCount, failedCount]
      properties:
        status:
          type: string
          enum: [partial]
        importedCount:
          type: integer
          minimum: 0
        failedCount:
          type: integer
          minimum: 0

    LogEvent:
      type: object
      required: [timestamp, level, message]
      properties:
        timestamp:
          type: string
          format: date-time
        level:
          type: string
          enum: [debug, info, warn, error]
        message:
          type: string

    FilteredLogEvent:
      type: object
      required: [timestamp, level, message]
      properties:
        timestamp:
          type: string
          format: date-time
        level:
          type: string
        message:
          type: string

    DiagnosticEvent:
      type: object
      required: [level, message]
      properties:
        level:
          type: string
          enum: [warn, error]
        message:
          type: string

    Tenant:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
        name:
          type: string

    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object
          additionalProperties: true
```

---

## 21. `cli-contracts.config.yaml`

The contract defines what the CLI interface is. The config defines how tooling validates, generates, tests, and exports artifacts.

```yaml
version: 0.1.0

input:
  files:
    - cli-contract.yaml
    - cli-contracts/*.yaml

validation:
  schema: ./schemas/cli-contracts.schema.json
  strict: true
  resolveExternalRefs: true
  allowUnknownExtensions: true

executionProfiles:
  local:
    default: true
    commandSets:
      foo:
        command: foo
      foo-admin:
        command: foo-admin

  npm:
    commandSets:
      foo:
        command: npx foo-cli
      foo-admin:
        command: npx foo-admin-cli

  docker:
    commandSets:
      foo:
        command: docker run --rm ghcr.io/example/foo

generators:
  typescript:
    enabled: true
    output: ./generated/typescript
    templates: builtin:typescript
    options:
      runtime: node
      emitTypes: true
      emitClient: true
      emitValidators: true

  rust:
    enabled: true
    output: ./generated/rust
    templates: builtin:rust
    options:
      crateName: foo_cli_contracts
      emitStructs: true
      emitClapBindings: true
      emitValidators: true

  markdown:
    enabled: true
    output: ./docs/cli.md
    templates: builtin:markdown
    options:
      includeExamples: true
      includeSchemas: true
      includeExtensions: true

  custom-go:
    enabled: false
    output: ./generated/go
    templates: ./templates/go
    options:
      packageName: foocli

contractTests:
  enabled: true
  profile: local
  casesDir: ./tests/cli-contracts
  timeoutMs: 30000
  validateStdout: true
  validateStderr: true
  validateFiles: true
  env:
    FOO_ENV: test

diff:
  breakingChangePolicy: strict
  ignore:
    - info.description
```

---

## 22. CLI tool commands

The `cli-contracts` tool should provide these commands.

### `init`

Initialize a contract file or project layout.

```bash
cli-contracts init
cli-contracts init --name foo --multi-command-set
```

### `validate`

Validate contract syntax, schema references, command IDs, paths, exits, and config.

```bash
cli-contracts validate
cli-contracts validate --file cli-contract.yaml
cli-contracts validate --config cli-contracts.config.yaml
```

Validation should check:

- required fields
- duplicate command IDs
- duplicate command paths within a command set
- invalid option aliases
- invalid or unreachable `$ref`
- exit keys are valid exit codes
- stream formats and framing
- file schema references
- extension property structure (when known profiles like `x-agent` are used)
- config generator validity

### `generate`

Generate code, docs, tests, or custom targets.

```bash
cli-contracts generate
cli-contracts generate typescript
cli-contracts generate rust
cli-contracts generate markdown
cli-contracts generate custom-go
```

### `docs`

Shortcut for Markdown documentation generation.

```bash
cli-contracts docs
cli-contracts docs --output docs/cli.md
```

### `test`

Run contract tests against an actual CLI implementation.

```bash
cli-contracts test
cli-contracts test --profile local
cli-contracts test --case users.import.success
```

### `diff`

Compare two contract versions and detect breaking changes.

```bash
cli-contracts diff old.yaml new.yaml
cli-contracts diff --base main --head HEAD
```

---

## 23. Generator architecture

Generators should use a normalized intermediate representation.

```text
cli-contract.yaml
  -> parse
  -> validate
  -> resolve refs
  -> normalize commandSets and commands
  -> generator context
  -> Handlebars templates
  -> output files
```

### Generator context

The normalized context should expose:

```yaml
specVersion: 0.1.0
info: {}
commandSets:
  - id: foo
    executable: foo
    commands:
      - id: users.import
        fullId: foo.users.import
        path: [users, import]
        invocation: foo users import
        arguments: []
        options: []
        exits: []
components: {}
```

The normalized context may convert maps to arrays for template iteration, but the source document should keep `commands` as a map.

### Built-in generators

| Generator | Purpose |
|---|---|
| `typescript` | Generate TS types, validators, command wrappers, result discriminated unions |
| `rust` | Generate Rust structs, enums, validators, optional clap bindings |
| `markdown` | Generate human-readable CLI reference documentation |

### Custom generators

Custom generators are directories containing Handlebars templates and a manifest.

```text
templates/go/
  generator.yaml
  command.go.hbs
  types.go.hbs
  README.md.hbs
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

---

## 24. TypeScript generator target

The TypeScript generator should produce:

```text
generated/typescript/
  index.ts
  types.ts
  commands.ts
  validators.ts
  schemas.ts
```

Recommended outputs:

- argument and option types
- exit types keyed by exit code
- stdout/stderr schema validators
- generated file validators
- safe command builder
- execution result parser
- extension metadata export

Example generated shape:

```ts
export type UsersImportExitCode = 0 | 2 | 10;

export type UsersImportResult =
  | { exitCode: 0; stdout: ImportUsersResult; stderr?: never }
  | { exitCode: 2; stdout?: never; stderr: Error }
  | { exitCode: 10; stdout?: ImportUsersPartialResult; stderr: Error };
```

---

## 25. Rust generator target

The Rust generator should produce:

```text
generated/rust/
  Cargo.toml
  src/
    lib.rs
    types.rs
    commands.rs
    validators.rs
```

Recommended outputs:

- `serde` structs for schemas
- exit enums keyed by exit code
- optional `clap` bindings
- command builder types
- stdout/stderr parser functions

Example generated shape:

```rust
pub enum UsersImportResult {
    Success { stdout: ImportUsersResult },
    InvalidArgument { stderr: Error },
    PartialFailure { stdout: Option<ImportUsersPartialResult>, stderr: Error },
}
```

---

## 26. Markdown documentation generator

The built-in Markdown generator should render:

- overview
- command set list
- command reference
- usage
- arguments
- options
- file inputs and outputs
- stream behavior
- exit contracts
- stdout/stderr schemas
- generated files
- examples
- extension metadata (e.g. `x-agent`)
- compatibility notes

Example output structure:

```markdown
# Foo CLI Contracts

## Command Sets

### foo

#### users.import

Usage: `foo users import <input> [--dry-run]`

##### Arguments

##### Options

##### Exits
```

---

## 27. Contract tests

Contract tests verify that a real CLI implementation conforms to the contract.

Test case example:

```yaml
id: users.import.success
commandSet: foo
command: users.import
profile: local
args:
  input: ./fixtures/users.csv
options:
  dry-run: true
expect:
  exitCode: 0
  stdout:
    matchesSchema: '#/components/schemas/ImportUsersResult'
  stderr:
    absent: true
```

The test runner should:

1. Resolve the command set and execution profile.
2. Build command invocation from `executable`, `path`, arguments, and options.
3. Execute the process.
4. Validate exit code.
5. Validate stdout and stderr based on `exits.<exitCode>`.
6. Validate generated files when declared.
7. Report contract violations.

---

## 28. Compatibility and breaking changes

Breaking changes fall into two categories: changes that affect CLI users (people invoking the command) and changes that affect contract consumers (codegen, tests, `$ref` references, tooling).

### Breaking for CLI users

These changes break the command line invocation or output that CLI users depend on:

- removing a command set
- changing `executable` for a public command set
- removing a command
- changing a command's effective path (derived or explicit)
- changing argument order
- adding a required argument
- adding a required option
- removing an option
- changing option meaning
- changing default value semantics
- changing exit code meaning
- removing an exit code
- changing stdout/stderr format
- changing stdout/stderr schema incompatibly
- removing a required output field
- changing file schema incompatibly
- changing stream framing incompatibly
- changing stream item schema incompatibly

### Breaking for contract consumers

These changes break codegen output, test references, or tooling that depends on stable contract identifiers:

- changing a command ID (even if the effective path is preserved via explicit `path` override)
- renaming a command set key
- changing `$ref` targets in `components`
- changing extension properties that consumers depend on (e.g. `x-agent.riskLevel`)

A command ID change with an explicit `path` that preserves the CLI invocation is not breaking for CLI users, but is breaking for contract consumers (codegen, tests, and any tooling that references the command by ID).

### Usually non-breaking changes

The following are usually non-breaking:

- adding a new command
- adding an optional option
- adding optional output fields
- adding examples
- adding documentation
- adding a new command set
- adding a new exit code, if callers are required to handle unknown non-zero codes generically

Enum value additions should be treated carefully because many CLI consumers use exhaustive matching.

---

## 29. Differences from OpenCLI

OpenCLI is an existing early-stage CLI description specification. CLI Contracts does not use OpenCLI as its internal schema. OpenCLI export is not part of the core specification, but may be provided by tooling as an optional compatibility generator.

The following table summarizes the key design differences:

| Aspect | CLI Contracts | OpenCLI |
|---|---|---|
| Command structure | `commands` is a **map** keyed by stable command ID | Commands are a **nested tree** |
| Command identity | Stable `commandId` (e.g. `users.import`) with path derived from ID | Identity derived from tree nesting |
| Multiple executables | `commandSets` allows multiple independent executables in one document | Single command root per document |
| Exit code modeling | `exits.<exitCode>` with per-code `stdout`, `stderr`, `files` contracts | `exitCodes` as a flat descriptive list |
| Structured output | `stdout` and `stderr` have `format`, `schema`, `examples` per exit code | No per-exit-code output contract |
| File I/O | First-class `file` contracts on arguments, options, and generated files | No file contract model |
| Stream modeling | `streams` with `framing`, `itemSchema`, `flush` | No stream model |
| Signal handling | `signals` declares handled OS signals with description | No signal model |
| Shared components | `components` with `schemas`, `examples`, `exits` using `$ref` (JSON Schema) | No shared component system |
| Schema compatibility | JSON Schema compatible | N/A |
| Code generation | Handlebars-based generators for TypeScript, Rust, Markdown, and custom targets | N/A |
| Contract testing | Built-in test runner with execution profiles | N/A |
| Breaking change detection | `diff` command with breaking change policy | N/A |

### Example comparison

CLI Contracts:

```yaml
cliContracts: 0.1.0
commandSets:
  foo:
    commands:
      users.import:
        exits:
          '0':
            description: Success.
            stdout:
              format: json
              schema:
                $ref: '#/components/schemas/ImportUsersResult'
          '2':
            description: Invalid input.
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'
```

OpenCLI equivalent (approximate):

```yaml
opencli: 0.1.0
command:
  name: foo
  commands:
    - name: users
      commands:
        - name: import
          exitCodes:
            - code: 0
              description: Success.
            - code: 2
              description: Invalid input.
```

Note that the OpenCLI representation cannot express per-exit-code stdout/stderr schemas, file contracts, stream behavior, or extension metadata. These are the areas where CLI Contracts provides significantly richer contract definitions.

---

## 30. MVP scope

Recommended MVP implementation:

1. `cli-contract.yaml` parser
2. JSON Schema validation
3. `$ref` resolution
4. `commandSets` support
5. `commands` map support
6. arguments and options
7. file contracts
8. `exits.<exitCode>.stdout/stderr/files`
9. built-in Markdown generator
10. built-in TypeScript generator
11. built-in Rust generator
12. custom Handlebars generator
13. `cli-contracts.config.yaml`
14. basic diff checker
15. basic contract test runner

Defer advanced features if needed:

- complex stream backpressure semantics
- interactive prompts
- terminal UI contracts
- shell completion generation
- full semantic version policy engine
- rich `x-agent` planning hints

---

## 31. Recommended repository layout

```text
repo/
  cli-contract.yaml
  cli-contracts.config.yaml
  cli-contracts/
    extra-command-set.yaml
  schemas/
    cli-contracts.schema.json
    users.csv.schema.json
  templates/
    go/
      generator.yaml
      types.go.hbs
  generated/
    typescript/
    rust/
  docs/
    cli.md
  tests/
    cli-contracts/
      users.import.success.yaml
      users.import.invalid.yaml
```

---

## 32. Summary

CLI Contracts should be designed as an OpenAPI-like contract specification for command line interfaces.

The key schema decisions are:

```text
cliContracts: 0.1.0
commandSets:
  <commandSetId>:
    executable: <user-facing executable name>
    commands:
      <commandId>:
        arguments: []
        options: []
        streams: {}
        exits:
          <exitCode>:
            stdout: {}
            stderr: {}
            files: []
```

The most important differences from OpenCLI are:

- `commands` is a map keyed by stable command ID.
- `path` is derived from the command ID by default, with explicit override when needed.
- `exits` is the canonical exit-code contract with per-code stdout/stderr/files.
- streams and file contracts are first-class; agent metadata is supported via `x-agent` extension.

CLI Contracts is an independent specification. It does not use OpenCLI as its internal schema. OpenCLI export is not part of the core specification, but may be provided by tooling as an optional compatibility generator.
