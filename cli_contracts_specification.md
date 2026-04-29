# CLI Contracts Specification Draft

Version: 0.1.0-draft  
Positioning: OpenAPI-like contract specification for command line interfaces  
Primary artifact: `cli-contract.yaml`  
Companion config: `cli-contracts.config.yaml`  
Tool name: `cli-contracts`  
Relationship to OpenCLI: independent native schema; OpenCLI is not used as internal schema

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
- AI agent tool definition and safety policy
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

CLI Contracts is an independent specification. It is not based on the OpenCLI schema, and does not export to OpenCLI format. The key design differences are:

```text
CLI Contracts                          OpenCLI
─────────────────────────────────────  ──────────────────────────────
commands is a map (stable IDs)         commands is a nested tree
path is an explicit array              path is implicit from nesting
responses keyed by exit code           exitCodes is a flat list
stdout/stderr/files per exit code      no per-exit-code output contract
streams are first-class                no stream model
file contracts on args/options         no file contract model
agent metadata (risk, side effects)    no agent model
components with $ref (JSON Schema)     no shared component system
```

CLI Contracts shares the goal of describing CLI interfaces in a machine-readable way, but takes an OpenAPI-inspired approach with richer response contracts, file I/O, stream modeling, and AI-agent awareness that OpenCLI does not cover.

---

## 4. Design principles

1. **Contract first**  
   `cli-contract.yaml` is the canonical source of truth.

2. **Multiple command sets**  
   A single contract file can define multiple independent CLI executables or command groups.

3. **Commands are a map**  
   `commandSets.<setId>.commands` is a map keyed by stable command IDs.

4. **Command path is explicit**  
   Each command defines its CLI path, such as `[users, import]`, separately from its stable ID.

5. **OpenAPI-like responses**  
   CLI results are described by `responses.<exitCode>`.

6. **Exit codes are response keys**  
   Exit code definitions are not only a list. They are first-class response contracts.

7. **Structured stdout and stderr**  
   `stdout` and `stderr` can be specified independently for each exit code.

8. **Files are first-class**  
   Input files, output files, and generated files can have media types, encodings, and schemas.

9. **Streams are first-class**  
   Pipe-based continuous I/O is modeled separately from one-shot output.

10. **JSON Schema compatible**  
    Data schemas should be JSON Schema compatible where possible.

11. **Template-based generation**  
    Generators are based on Handlebars templates and can be extended to multiple languages.

12. **AI-agent-aware**  
    Tool risk, side effects, idempotency, confirmation requirements, and dry-run options can be specified.

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
| command path | Actual CLI subcommand path, such as `[users, import]` |
| argument | Positional parameter |
| option | Named flag or option, such as `--config` |
| response | Result contract associated with an exit code |
| stream | Continuous pipe-based input/output |
| file parameter | Argument or option whose value points to a file |
| generated file | File produced by command execution |
| execution profile | Environment-specific way to execute the CLI during validation or tests |
| generator | Tool that emits code, docs, tests, wrappers, or OpenCLI output |
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
  main:
    executable: foo
    summary: Main user-facing CLI.
    commands:
      users.import:
        path: [users, import]
        summary: Import users from CSV.
        arguments: []
        options: []
        responses: {}

  admin:
    executable: foo-admin
    summary: Administrative CLI.
    commands:
      tenants.create:
        path: [tenants, create]
        summary: Create tenant.
        arguments: []
        options: []
        responses: {}

components:
  schemas: {}
```

### Required top-level fields

| Field | Required | Description |
|---|---:|---|
| `cliContracts` | yes | Specification version |
| `info` | yes | Metadata about this contract document |
| `commandSets` | yes | One or more CLI command sets |
| `components` | no | Shared schemas, examples, responses, and reusable definitions |

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
  main:
    executable: foo
    summary: Main CLI.
    commands:
      users.import:
        path: [users, import]
        summary: Import users.

  admin:
    executable: foo-admin
    summary: Admin CLI.
    commands:
      tenants.create:
        path: [tenants, create]
        summary: Create tenant.
```

### `commandSets.<setId>` fields

| Field | Required | Description |
|---|---:|---|
| `executable` | yes | User-facing CLI executable name, such as `foo` |
| `summary` | no | Short description |
| `description` | no | Long description |
| `commands` | yes | Map of command definitions keyed by stable command ID |
| `globalOptions` | no | Options accepted by all commands in this set |
| `env` | no | Environment variables that are part of the public interface |
| `agent` | no | Default agent policy for commands in this set |

### Contract vs runtime environment

The following belong in the contract because they are user-facing interface:

```yaml
commandSets:
  main:
    executable: foo
    commands:
      users.import:
        path: [users, import]
```

The following should usually be placed in `cli-contracts.config.yaml` because they are runtime-specific:

```yaml
executionProfiles:
  local:
    commandSets:
      main:
        command: foo
  npm:
    commandSets:
      main:
        command: npx foo-cli
  docker:
    commandSets:
      main:
        command: docker run --rm ghcr.io/example/foo
```

---

## 9. Commands are a map

`commands` MUST be a map, not an array.

```yaml
commands:
  users.import:
    path: [users, import]
    summary: Import users from CSV.

  users.export:
    path: [users, export]
    summary: Export users.
```

The map key is the stable command ID. It is used for references, diffing, code generation, docs anchors, and tests.

The command `path` defines the actual subcommand path used on the command line.

```yaml
commands:
  users.import:
    path: [users, import]
```

This represents:

```bash
foo users import
```

### Why map + path

| Concern | Solution |
|---|---|
| Stable references | map key, e.g. `users.import` |
| Actual CLI syntax | `path`, e.g. `[users, import]` |
| Diff friendliness | map keys are stable |
| Code generation | command IDs are stable symbol sources |
| OpenCLI export | command tree can be generated from paths |
| Multiple command sets | full identity is `<commandSetId>.<commandId>` |

---

## 10. Command object

```yaml
commands:
  users.import:
    path: [users, import]
    summary: Import users from a CSV file.
    description: Reads a user CSV file and imports users into the system.
    usage:
      - foo users import <input> [--dry-run]
    arguments: []
    options: []
    stdin:
      accepted: false
    streams: {}
    responses: {}
    examples: []
    agent: {}
```

| Field | Required | Description |
|---|---:|---|
| `path` | yes | CLI subcommand path excluding executable |
| `summary` | yes | Short description |
| `description` | no | Long description |
| `usage` | no | Human-readable usage examples |
| `arguments` | no | Positional arguments |
| `options` | no | Command-specific options |
| `stdin` | no | One-shot stdin contract |
| `streams` | no | Continuous stream contract |
| `responses` | yes | Exit-code keyed response contracts |
| `examples` | no | Examples |
| `agent` | no | AI-agent execution metadata |
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

`schema` is optional. If omitted, the contract specifies that the value is a file, but does not validate file content.

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

## 14. One-shot stdin

Use `stdin` for non-streaming input passed through standard input.

```yaml
stdin:
  accepted: true
  required: false
  format: json
  schema:
    $ref: '#/components/schemas/InputPayload'
```

| Field | Required | Description |
|---|---:|---|
| `accepted` | yes | Whether stdin is accepted |
| `required` | no | Whether stdin is required |
| `format` | no | `json`, `yaml`, `text`, `binary`, etc. |
| `schema` | no | Schema for the whole stdin payload |

Use `streams.stdin` instead of `stdin` for line-delimited or long-running pipe input.

---

## 15. Responses keyed by exit code

`responses` is a map keyed by process exit code.

```yaml
responses:
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
      optional: true
      format: json
      schema:
        $ref: '#/components/schemas/ImportUsersPartialResult'
    stderr:
      format: json
      schema:
        $ref: '#/components/schemas/Error'
```

### Response object fields

| Field | Required | Description |
|---|---:|---|
| `description` | yes | Human-readable meaning of the exit code |
| `stdout` | no | stdout contract for this exit code |
| `stderr` | no | stderr contract for this exit code |
| `files` | no | Generated file contracts for this exit code |
| `headers` | no | Reserved for future metadata-like outputs |

### Output contract fields

```yaml
stdout:
  optional: false
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
| `optional` | no | Whether this output may be absent. Default is `false` when the output object is present |
| `format` | yes | `json`, `yaml`, `text`, `table`, `binary`, `ndjson`, etc. |
| `schema` | no | Schema for this output |
| `examples` | no | Named examples |

### Recommended response rules

- If `stdout` is defined and `optional` is not true, the implementation must emit matching stdout.
- If `stderr` is defined and `optional` is not true, the implementation must emit matching stderr.
- If `stdout` or `stderr` is not defined for an exit code, that output should not be relied on as part of the contract.
- Undefined exit codes are outside the compatibility guarantee.
- Exit code meanings must not change in a backward-compatible release.

---

## 16. Generated files

Commands can generate files as part of their response.

```yaml
responses:
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

## 17. Streams and pipe-based continuous I/O

Use `streams` for continuous pipe input or output, such as:

```bash
tail -f app.log | foo logs filter --level error
foo events watch | jq .
```

Streams are separate from one-shot `stdin` and `responses.*.stdout`.

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
    optional: true
    format: ndjson
    itemSchema:
      $ref: '#/components/schemas/DiagnosticEvent'

  termination:
    onEndOfInput: exit
    onSignal:
      SIGINT:
        behavior: graceful_shutdown
        exitCode: 130
      SIGTERM:
        behavior: graceful_shutdown
        exitCode: 143

  errorHandling:
    invalidItem:
      behavior: skip
      stderr:
        format: ndjson
        itemSchema:
          $ref: '#/components/schemas/StreamItemError'
    fatalError:
      behavior: exit
      exitCode: 10
```

### Stream object fields

| Field | Required | Description |
|---|---:|---|
| `required` | no | Whether the stream is required |
| `optional` | no | Whether the stream may be absent |
| `format` | yes | `text-lines`, `ndjson`, `json-seq`, `csv`, `bytes`, etc. |
| `encoding` | no | Encoding for text streams |
| `framing` | no | Message boundary definition |
| `itemSchema` | no | Schema for each item in the stream |
| `flush` | no | Flush policy |

For streams, the schema should usually be `itemSchema`, not `schema`, because each message is the contract unit.

---

## 18. Agent metadata

AI agents need more than syntax. They need risk and execution policy.

```yaml
agent:
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

Agent metadata may be defined at the command set level and overridden at the command level.

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
  responses: {}
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
  main:
    executable: foo
    summary: Main user-facing CLI.
    globalOptions:
      - name: verbose
        aliases: [v]
        schema:
          type: boolean
          default: false

    commands:
      users.import:
        path: [users, import]
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
              schema:
                $ref: ./schemas/users.csv.schema.json

        options:
          - name: dry-run
            aliases: [n]
            description: Validate only. Do not write to the database.
            schema:
              type: boolean
              default: false

        stdin:
          accepted: false

        responses:
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
              optional: true
              format: json
              schema:
                $ref: '#/components/schemas/ImportUsersPartialResult'
            stderr:
              format: json
              schema:
                $ref: '#/components/schemas/Error'

        agent:
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
        path: [logs, filter]
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
            optional: true
            format: ndjson
            itemSchema:
              $ref: '#/components/schemas/DiagnosticEvent'

          termination:
            onEndOfInput: exit
            onSignal:
              SIGINT:
                behavior: graceful_shutdown
                exitCode: 130
              SIGTERM:
                behavior: graceful_shutdown
                exitCode: 143

        responses:
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

  admin:
    executable: foo-admin
    summary: Administrative CLI.
    commands:
      tenants.create:
        path: [tenants, create]
        summary: Create tenant.
        arguments:
          - name: name
            required: true
            schema:
              type: string
        responses:
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
      main:
        command: foo
      admin:
        command: foo-admin

  npm:
    commandSets:
      main:
        command: npx foo-cli
      admin:
        command: npx foo-admin-cli

  docker:
    commandSets:
      main:
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
      includeAgentPolicy: true

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

Validate contract syntax, schema references, command IDs, paths, responses, and config.

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
- response keys are valid exit codes
- stream formats and framing
- file schema references
- agent policy values
- config generator validity

### `generate`

Generate code, docs, OpenCLI output, tests, or custom targets.

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
  - id: main
    executable: foo
    commands:
      - id: users.import
        fullId: main.users.import
        path: [users, import]
        invocation: foo users import
        arguments: []
        options: []
        responses: []
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
- response types keyed by exit code
- stdout/stderr schema validators
- generated file validators
- safe command builder
- execution result parser
- agent metadata export

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
- response enums keyed by exit code
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
- exit-code responses
- stdout/stderr schemas
- generated files
- examples
- agent policy
- compatibility notes

Example output structure:

```markdown
# Foo CLI Contracts

## Command Sets

### main: foo

#### users.import

Usage: `foo users import <input> [--dry-run]`

##### Arguments

##### Options

##### Responses

##### Agent policy
```

---

## 27. Contract tests

Contract tests verify that a real CLI implementation conforms to the contract.

Test case example:

```yaml
id: users.import.success
commandSet: main
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
5. Validate stdout and stderr based on `responses.<exitCode>`.
6. Validate generated files when declared.
7. Report contract violations.

---

## 28. Compatibility and breaking changes

### Breaking changes

The following should be treated as breaking changes:

- removing a command set
- changing `executable` for a public command set
- removing a command
- changing a command `path`
- changing argument order
- adding a required argument
- adding a required option
- removing an option
- changing option meaning
- changing default value semantics
- changing response exit code meaning
- removing a response exit code
- changing stdout/stderr format
- changing stdout/stderr schema incompatibly
- removing a required output field
- changing file schema incompatibly
- changing stream framing incompatibly
- changing stream item schema incompatibly
- increasing agent risk without versioning policy

### Usually non-breaking changes

The following are usually non-breaking:

- adding a new command
- adding an optional option
- adding optional output fields
- adding examples
- adding documentation
- adding a new command set
- adding a new response exit code, if callers are required to handle unknown non-zero codes generically

Enum value additions should be treated carefully because many CLI consumers use exhaustive matching.

---

## 29. Differences from OpenCLI

OpenCLI is an existing early-stage CLI description specification. CLI Contracts is an independent specification that does not reuse the OpenCLI schema and does not provide export to OpenCLI format.

The following table summarizes the key design differences:

| Aspect | CLI Contracts | OpenCLI |
|---|---|---|
| Command structure | `commands` is a **map** keyed by stable command ID | Commands are a **nested tree** |
| Command identity | Stable `commandId` (e.g. `users.import`) + explicit `path` array | Identity derived from tree nesting |
| Multiple executables | `commandSets` allows multiple independent executables in one document | Single command root per document |
| Exit code modeling | `responses.<exitCode>` with per-code `stdout`, `stderr`, `files` contracts | `exitCodes` as a flat descriptive list |
| Structured output | `stdout` and `stderr` have `format`, `schema`, `examples` per exit code | No per-exit-code output contract |
| File I/O | First-class `file` contracts on arguments, options, and generated files | No file contract model |
| Stream modeling | `streams` with `framing`, `itemSchema`, `flush`, `termination`, `errorHandling` | No stream model |
| Shared components | `components` with `schemas`, `examples`, `responses` using `$ref` (JSON Schema) | No shared component system |
| AI agent policy | `agent` metadata: `riskLevel`, `sideEffects`, `idempotent`, `requiresConfirmation` | No agent model |
| Schema compatibility | JSON Schema compatible | N/A |
| Code generation | Handlebars-based generators for TypeScript, Rust, Markdown, and custom targets | N/A |
| Contract testing | Built-in test runner with execution profiles | N/A |
| Breaking change detection | `diff` command with breaking change policy | N/A |

### Example comparison

CLI Contracts:

```yaml
cliContracts: 0.1.0
commandSets:
  main:
    executable: foo
    commands:
      users.import:
        path: [users, import]
        responses:
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

Note that the OpenCLI representation cannot express per-exit-code stdout/stderr schemas, file contracts, stream behavior, or agent metadata. These are the areas where CLI Contracts provides significantly richer contract definitions.

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
8. `responses.<exitCode>.stdout/stderr/files`
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
- rich agent planning hints

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
        path: [subcommand, path]
        arguments: []
        options: []
        streams: {}
        responses:
          <exitCode>:
            stdout: {}
            stderr: {}
            files: []
```

The most important differences from OpenCLI are:

- `commands` is a map keyed by stable command ID.
- `path` explicitly represents the CLI subcommand path.
- `responses` is the canonical exit-code contract with per-code stdout/stderr/files.
- streams, file contracts, and agent metadata are first-class.

CLI Contracts is an independent specification. It does not use OpenCLI as its internal schema and does not provide export to OpenCLI format.
