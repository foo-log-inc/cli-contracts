# CLI Contracts CLI

Contract definition for the cli-contracts command line tool itself. This is a self-referential contract: cli-contracts defines its own interface using the CLI Contracts specification.

**Version:** 0.6.0

## Table of Contents

- [cli-contracts](#cli-contracts)
  - [init](#cli-contracts-init)
  - [validate](#cli-contracts-validate)
  - [generate](#cli-contracts-generate)
  - [docs](#cli-contracts-docs)
  - [test](#cli-contracts-test)
  - [diff](#cli-contracts-diff)
  - [propose-agent-policy](#cli-contracts-propose-agent-policy)
  - [audit](#cli-contracts-audit)
  - [extract](#cli-contracts-extract)
  - [propose-tests](#cli-contracts-propose-tests)
  - [explain-diff](#cli-contracts-explain-diff)
  - [check-reference](#cli-contracts-check-reference)
  - [suggest](#cli-contracts-suggest)

---

## cli-contracts

Contract-first specification and toolchain for CLI interfaces.

### Global Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--config` | -c | No | `"cli-contracts.config.yaml"` | Path to cli-contracts.config.yaml. |
| `--verbose` | -v | No | `false` | Enable verbose output. |
| `--format` | -F | No | `"yaml"` | Output format for structured results (core commands only). Overrides the per-exit declared format at runtime; exit format declarations represent the default when this option is not explicitly set. Does NOT apply to LLM-powered commands which use --report-format instead. Precedence: core commands use --format; LLM commands use --report-format; --format is ignored by LLM commands. |
| `--quiet` | -q | No | `false` | Suppress informational/verbose output only. Does NOT suppress the primary structured stdout (schema guarantees remain valid). Only affects supplementary human-readable messages. |
| `--version` | -V | No |  | Print version and exit. |
| `--help` | -h | No |  | Show help and exit. |

### Environment Variables

| Variable | Description |
|---|---|
| `CURSOR_API_KEY` | API key for the Cursor adapter (required when --adapter=cursor). |
| `GEMINI_API_KEY` | API key for the Gemini adapter (required when --adapter=gemini). |
| `OPENAI_API_KEY` | API key for the OpenAI adapter (required when --adapter=openai). |
| `ANTHROPIC_API_KEY` | API key for the Claude adapter (required when --adapter=claude). |

### init

Initialize a contract file or project layout.

Generates a starter cli-contract.yaml (and optionally cli-contracts.config.yaml) in the current directory.

**Usage:**

```
cli-contracts init
```
```
cli-contracts init --name foo
```
```
cli-contracts init --name foo --multi-command-set
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--name` | -n | No |  | Executable name for the initial command set. |
| `--multi-command-set` | -m | No | `false` | Scaffold multiple command sets. |
| `--output` | -o | No | `"."` | Output directory. |
| `--with-config` |  | No | `false` | Also generate cli-contracts.config.yaml. |

#### Exit Codes

**Exit 0:** Project initialized successfully.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `contractFile` | `string` | Yes | Path to the generated cli-contract.yaml. |
  | `configFile` | `string` | No | Path to the generated cli-contracts.config.yaml (if --with-config). |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "contractFile"
    ],
    "properties": {
      "contractFile": {
        "type": "string",
        "description": "Path to the generated cli-contract.yaml."
      },
      "configFile": {
        "type": "string",
        "description": "Path to the generated cli-contracts.config.yaml (if --with-config)."
      }
    }
  }
  ```

  </details>

- **Generated files:**
  - `{stdout.contractFile}` (application/yaml)
  - `{stdout.configFile}` (application/yaml) *(optional)*

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid arguments.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 4:** Target file already exists.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### validate

Validate contract files.

Validates contract syntax, JSON Schema conformance, $ref resolution, duplicate command IDs, option aliases, exit codes, stream definitions, file schema references, and config generator settings.

**Usage:**

```
cli-contracts validate
```
```
cli-contracts validate --file cli-contract.yaml
```
```
cli-contracts validate --strict
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file(s) to validate. Defaults to config input.files. |
| `--strict` |  | No | `false` | Treat warnings as errors. |
| `--resolve-refs` |  | No | `true` | Resolve and validate external $ref targets. |

#### Exit Codes

**Exit 0:** All contracts are valid.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `valid` | `boolean` | Yes |  |
  | `errorCount` | `integer (min: 0)` | Yes |  |
  | `warningCount` | `integer (min: 0)` | Yes |  |
  | `errors` | `object[]` | Yes |  |
  | `errors[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `errors[].message` | `string` | Yes |  |
  | `errors[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `errors[].severity` | `"error" \| "warning"` | No |  |
  | `warnings` | `object[]` | Yes |  |
  | `warnings[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `warnings[].message` | `string` | Yes |  |
  | `warnings[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `warnings[].severity` | `"error" \| "warning"` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "valid",
      "errorCount",
      "warningCount",
      "errors",
      "warnings"
    ],
    "properties": {
      "valid": {
        "type": "boolean"
      },
      "errorCount": {
        "type": "integer",
        "minimum": 0
      },
      "warningCount": {
        "type": "integer",
        "minimum": 0
      },
      "errors": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      },
      "warnings": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid arguments.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 9:** Validation completed but found errors in the contract.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `valid` | `boolean` | Yes |  |
  | `errorCount` | `integer (min: 0)` | Yes |  |
  | `warningCount` | `integer (min: 0)` | Yes |  |
  | `errors` | `object[]` | Yes |  |
  | `errors[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `errors[].message` | `string` | Yes |  |
  | `errors[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `errors[].severity` | `"error" \| "warning"` | No |  |
  | `warnings` | `object[]` | Yes |  |
  | `warnings[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `warnings[].message` | `string` | Yes |  |
  | `warnings[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `warnings[].severity` | `"error" \| "warning"` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "valid",
      "errorCount",
      "warningCount",
      "errors",
      "warnings"
    ],
    "properties": {
      "valid": {
        "type": "boolean"
      },
      "errorCount": {
        "type": "integer",
        "minimum": 0
      },
      "warningCount": {
        "type": "integer",
        "minimum": 0
      },
      "errors": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      },
      "warnings": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      }
    }
  }
  ```

  </details>

- **stderr:** format=`json` *(optional)*

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### generate

Run code generators.

Runs one or more generators defined in cli-contracts.config.yaml. If no generator name is given, all enabled generators are run.

**Usage:**

```
cli-contracts generate
```
```
cli-contracts generate typescript
```
```
cli-contracts generate rust
```
```
cli-contracts generate markdown
```
```
cli-contracts generate custom-go
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `generators` *(variadic)* | No | Generator name(s) to run. If omitted, all enabled generators run. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file(s) to use as input. |
| `--output` | -o | No |  | Override output directory. |
| `--dry-run` | -n | No | `false` | Show what would be generated without writing files. |
| `--clean` |  | No | `false` | Remove output directory before generating. |

#### Exit Codes

**Exit 0:** Generation succeeded.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `generators` | `object[]` | Yes |  |
  | `generators[].name` | `string` | Yes | Generator name (e.g. typescript, rust, markdown). |
  | `generators[].status` | `"success" \| "skipped" \| "failed"` | Yes |  |
  | `generators[].files` | `string[]` | Yes | List of generated file paths. |
  | `generators[].error` | `string` | No | Error message if status is failed. |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "generators"
    ],
    "properties": {
      "generators": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "name",
            "status",
            "files"
          ],
          "properties": {
            "name": {
              "type": "string",
              "description": "Generator name (e.g. typescript, rust, markdown)."
            },
            "status": {
              "type": "string",
              "enum": [
                "success",
                "skipped",
                "failed"
              ]
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of generated file paths."
            },
            "error": {
              "type": "string",
              "description": "Error message if status is failed."
            }
          }
        }
      }
    }
  }
  ```

  </details>

- **Generated files:**
  - `{stdout.generators[*].files[*]}` *(optional)*

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid arguments or unknown generator name.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation failed (generation aborted).

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `valid` | `boolean` | Yes |  |
  | `errorCount` | `integer (min: 0)` | Yes |  |
  | `warningCount` | `integer (min: 0)` | Yes |  |
  | `errors` | `object[]` | Yes |  |
  | `errors[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `errors[].message` | `string` | Yes |  |
  | `errors[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `errors[].severity` | `"error" \| "warning"` | No |  |
  | `warnings` | `object[]` | Yes |  |
  | `warnings[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `warnings[].message` | `string` | Yes |  |
  | `warnings[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `warnings[].severity` | `"error" \| "warning"` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "valid",
      "errorCount",
      "warningCount",
      "errors",
      "warnings"
    ],
    "properties": {
      "valid": {
        "type": "boolean"
      },
      "errorCount": {
        "type": "integer",
        "minimum": 0
      },
      "warningCount": {
        "type": "integer",
        "minimum": 0
      },
      "errors": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      },
      "warnings": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 5:** Generation partially failed.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `generators` | `object[]` | Yes |  |
  | `generators[].name` | `string` | Yes | Generator name (e.g. typescript, rust, markdown). |
  | `generators[].status` | `"success" \| "skipped" \| "failed"` | Yes |  |
  | `generators[].files` | `string[]` | Yes | List of generated file paths. |
  | `generators[].error` | `string` | No | Error message if status is failed. |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "generators"
    ],
    "properties": {
      "generators": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "name",
            "status",
            "files"
          ],
          "properties": {
            "name": {
              "type": "string",
              "description": "Generator name (e.g. typescript, rust, markdown)."
            },
            "status": {
              "type": "string",
              "enum": [
                "success",
                "skipped",
                "failed"
              ]
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of generated file paths."
            },
            "error": {
              "type": "string",
              "description": "Error message if status is failed."
            }
          }
        }
      }
    }
  }
  ```

  </details>

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

#### Extensions

```yaml
x-agent: 
  recommended_before_use: 
    - Run with --dry-run first to preview generated files
```

---

### docs

Generate Markdown documentation.

Generates Markdown CLI reference documentation from the contract. A simplified interface for the markdown generator; does not support --clean or generator selection. Use "cli-contracts generate markdown" for full control.

**Usage:**

```
cli-contracts docs
```
```
cli-contracts docs --output docs/cli.md
```
```
cli-contracts docs --dry-run
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file(s) to use as input. |
| `--output` | -o | No |  | Output file path. |
| `--dry-run` | -n | No | `false` | Show what would be generated without writing files. |

#### Exit Codes

**Exit 0:** Documentation generated successfully.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `generators` | `object[]` | Yes |  |
  | `generators[].name` | `string` | Yes | Generator name (e.g. typescript, rust, markdown). |
  | `generators[].status` | `"success" \| "skipped" \| "failed"` | Yes |  |
  | `generators[].files` | `string[]` | Yes | List of generated file paths. |
  | `generators[].error` | `string` | No | Error message if status is failed. |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "generators"
    ],
    "properties": {
      "generators": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "name",
            "status",
            "files"
          ],
          "properties": {
            "name": {
              "type": "string",
              "description": "Generator name (e.g. typescript, rust, markdown)."
            },
            "status": {
              "type": "string",
              "enum": [
                "success",
                "skipped",
                "failed"
              ]
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "List of generated file paths."
            },
            "error": {
              "type": "string",
              "description": "Error message if status is failed."
            }
          }
        }
      }
    }
  }
  ```

  </details>

- **Generated files:**
  - `{stdout.generators[*].files[*]}` (text/markdown) *(optional)*

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid arguments.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation failed (generation aborted).

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `valid` | `boolean` | Yes |  |
  | `errorCount` | `integer (min: 0)` | Yes |  |
  | `warningCount` | `integer (min: 0)` | Yes |  |
  | `errors` | `object[]` | Yes |  |
  | `errors[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `errors[].message` | `string` | Yes |  |
  | `errors[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `errors[].severity` | `"error" \| "warning"` | No |  |
  | `warnings` | `object[]` | Yes |  |
  | `warnings[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `warnings[].message` | `string` | Yes |  |
  | `warnings[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `warnings[].severity` | `"error" \| "warning"` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "valid",
      "errorCount",
      "warningCount",
      "errors",
      "warnings"
    ],
    "properties": {
      "valid": {
        "type": "boolean"
      },
      "errorCount": {
        "type": "integer",
        "minimum": 0
      },
      "warningCount": {
        "type": "integer",
        "minimum": 0
      },
      "errors": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      },
      "warnings": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      }
    }
  }
  ```

  </details>

---

### test

Run contract tests.

Executes contract test cases against a real CLI implementation. Uses execution profiles from cli-contracts.config.yaml to invoke commands.

**Usage:**

```
cli-contracts test
```
```
cli-contracts test --profile local
```
```
cli-contracts test --case users.import.success
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--profile` | -p | No |  | Execution profile to use. |
| `--case` |  | No |  | Run a specific test case by ID. |
| `--cases-dir` |  | No |  | Directory containing test case YAML files. |
| `--timeout` | -t | No | `30000` | Timeout per test case in milliseconds. |
| `--bail` |  | No | `false` | Stop on first failure. |

#### Exit Codes

**Exit 0:** All tests passed.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `total` | `integer (min: 0)` | Yes |  |
  | `passed` | `integer (min: 0)` | Yes |  |
  | `failed` | `integer (min: 0)` | Yes |  |
  | `skipped` | `integer (min: 0)` | Yes |  |
  | `durationMs` | `integer (min: 0)` | No |  |
  | `cases` | `object[]` | Yes |  |
  | `cases[].id` | `string` | Yes | Test case ID. |
  | `cases[].status` | `"passed" \| "failed" \| "skipped"` | Yes |  |
  | `cases[].durationMs` | `integer (min: 0)` | No |  |
  | `cases[].violations` | `object[]` | No |  |
  | `cases[].violations[].type` | `enum(7 values)` | Yes |  |
  | `cases[].violations[].message` | `string` | Yes |  |
  | `cases[].violations[].expected` | `any` | No | Expected value or schema excerpt. |
  | `cases[].violations[].actual` | `any` | No | Actual value received. |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "total",
      "passed",
      "failed",
      "skipped",
      "cases"
    ],
    "properties": {
      "total": {
        "type": "integer",
        "minimum": 0
      },
      "passed": {
        "type": "integer",
        "minimum": 0
      },
      "failed": {
        "type": "integer",
        "minimum": 0
      },
      "skipped": {
        "type": "integer",
        "minimum": 0
      },
      "durationMs": {
        "type": "integer",
        "minimum": 0
      },
      "cases": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "id",
            "status"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Test case ID."
            },
            "status": {
              "type": "string",
              "enum": [
                "passed",
                "failed",
                "skipped"
              ]
            },
            "durationMs": {
              "type": "integer",
              "minimum": 0
            },
            "violations": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "type",
                  "message"
                ],
                "properties": {
                  "type": {
                    "type": "string",
                    "enum": [
                      "exit_code_mismatch",
                      "stdout_schema_mismatch",
                      "stderr_schema_mismatch",
                      "stdout_format_mismatch",
                      "stderr_format_mismatch",
                      "file_missing",
                      "file_schema_mismatch"
                    ]
                  },
                  "message": {
                    "type": "string"
                  },
                  "expected": {
                    "description": "Expected value or schema excerpt."
                  },
                  "actual": {
                    "description": "Actual value received."
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid arguments or missing profile.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation failed (tests aborted).

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `valid` | `boolean` | Yes |  |
  | `errorCount` | `integer (min: 0)` | Yes |  |
  | `warningCount` | `integer (min: 0)` | Yes |  |
  | `errors` | `object[]` | Yes |  |
  | `errors[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `errors[].message` | `string` | Yes |  |
  | `errors[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `errors[].severity` | `"error" \| "warning"` | No |  |
  | `warnings` | `object[]` | Yes |  |
  | `warnings[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `warnings[].message` | `string` | Yes |  |
  | `warnings[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `warnings[].severity` | `"error" \| "warning"` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "valid",
      "errorCount",
      "warningCount",
      "errors",
      "warnings"
    ],
    "properties": {
      "valid": {
        "type": "boolean"
      },
      "errorCount": {
        "type": "integer",
        "minimum": 0
      },
      "warningCount": {
        "type": "integer",
        "minimum": 0
      },
      "errors": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      },
      "warnings": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 6:** One or more tests failed. Uses a single failure exit code (no partial-success distinction) by design.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `total` | `integer (min: 0)` | Yes |  |
  | `passed` | `integer (min: 0)` | Yes |  |
  | `failed` | `integer (min: 0)` | Yes |  |
  | `skipped` | `integer (min: 0)` | Yes |  |
  | `durationMs` | `integer (min: 0)` | No |  |
  | `cases` | `object[]` | Yes |  |
  | `cases[].id` | `string` | Yes | Test case ID. |
  | `cases[].status` | `"passed" \| "failed" \| "skipped"` | Yes |  |
  | `cases[].durationMs` | `integer (min: 0)` | No |  |
  | `cases[].violations` | `object[]` | No |  |
  | `cases[].violations[].type` | `enum(7 values)` | Yes |  |
  | `cases[].violations[].message` | `string` | Yes |  |
  | `cases[].violations[].expected` | `any` | No | Expected value or schema excerpt. |
  | `cases[].violations[].actual` | `any` | No | Actual value received. |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "total",
      "passed",
      "failed",
      "skipped",
      "cases"
    ],
    "properties": {
      "total": {
        "type": "integer",
        "minimum": 0
      },
      "passed": {
        "type": "integer",
        "minimum": 0
      },
      "failed": {
        "type": "integer",
        "minimum": 0
      },
      "skipped": {
        "type": "integer",
        "minimum": 0
      },
      "durationMs": {
        "type": "integer",
        "minimum": 0
      },
      "cases": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "id",
            "status"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Test case ID."
            },
            "status": {
              "type": "string",
              "enum": [
                "passed",
                "failed",
                "skipped"
              ]
            },
            "durationMs": {
              "type": "integer",
              "minimum": 0
            },
            "violations": {
              "type": "array",
              "items": {
                "type": "object",
                "required": [
                  "type",
                  "message"
                ],
                "properties": {
                  "type": {
                    "type": "string",
                    "enum": [
                      "exit_code_mismatch",
                      "stdout_schema_mismatch",
                      "stderr_schema_mismatch",
                      "stdout_format_mismatch",
                      "stderr_format_mismatch",
                      "file_missing",
                      "file_schema_mismatch"
                    ]
                  },
                  "message": {
                    "type": "string"
                  },
                  "expected": {
                    "description": "Expected value or schema excerpt."
                  },
                  "actual": {
                    "description": "Actual value received."
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  ```

  </details>

---

### diff

Compare contract versions and detect breaking changes.

Compares two contract files (or git revisions) and reports additions, removals, modifications, and breaking changes. At least one input pair must be provided: either positional arguments (old new) or --base/--head options.

**Usage:**

```
cli-contracts diff old.yaml new.yaml
```
```
cli-contracts diff --base main --head HEAD --contract-path cli-contract.yaml
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `old` | No | Path to the old (base) contract file. Can be omitted when using --base/--head. |
| `new` | No | Path to the new (head) contract file. Can be omitted when using --base/--head. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--base` |  | No |  | Git ref for the base version (e.g. main, v1.0.0). |
| `--head` |  | No |  | Git ref for the head version (e.g. HEAD, feature-branch). |
| `--contract-path` | -p | No | `"cli-contract.yaml"` | Contract file path within the repository (used with --base/--head). |
| `--breaking-only` |  | No | `false` | Only report breaking changes. |
| `--text` |  | No | `false` | Output human-readable text summary instead of structured data. When active, stdout is plain text and does not conform to the DiffResult schema. Agents should avoid this option for parsing. |

#### Exit Codes

**Exit 0:** No breaking changes detected (may include non-breaking changes).

- **stdout:** format=`{options.text ? "text" : globalOptions.format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `hasBreakingChanges` | `boolean` | Yes |  |
  | `breakingCount` | `integer (min: 0)` | No |  |
  | `nonBreakingCount` | `integer (min: 0)` | No |  |
  | `changes` | `object[]` | Yes |  |
  | `changes[].type` | `"added" \| "removed" \| "changed"` | Yes |  |
  | `changes[].path` | `string` | Yes | JSON pointer to the changed location. |
  | `changes[].breaking` | `boolean` | Yes |  |
  | `changes[].description` | `string` | Yes |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "hasBreakingChanges",
      "changes"
    ],
    "properties": {
      "hasBreakingChanges": {
        "type": "boolean"
      },
      "breakingCount": {
        "type": "integer",
        "minimum": 0
      },
      "nonBreakingCount": {
        "type": "integer",
        "minimum": 0
      },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "type",
            "path",
            "breaking",
            "description"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "added",
                "removed",
                "changed"
              ]
            },
            "path": {
              "type": "string",
              "description": "JSON pointer to the changed location."
            },
            "breaking": {
              "type": "boolean"
            },
            "description": {
              "type": "string"
            }
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid arguments.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 7:** Breaking changes detected.

- **stdout:** format=`{options.text ? "text" : globalOptions.format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `hasBreakingChanges` | `boolean` | Yes |  |
  | `breakingCount` | `integer (min: 0)` | No |  |
  | `nonBreakingCount` | `integer (min: 0)` | No |  |
  | `changes` | `object[]` | Yes |  |
  | `changes[].type` | `"added" \| "removed" \| "changed"` | Yes |  |
  | `changes[].path` | `string` | Yes | JSON pointer to the changed location. |
  | `changes[].breaking` | `boolean` | Yes |  |
  | `changes[].description` | `string` | Yes |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "hasBreakingChanges",
      "changes"
    ],
    "properties": {
      "hasBreakingChanges": {
        "type": "boolean"
      },
      "breakingCount": {
        "type": "integer",
        "minimum": 0
      },
      "nonBreakingCount": {
        "type": "integer",
        "minimum": 0
      },
      "changes": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "type",
            "path",
            "breaking",
            "description"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "added",
                "removed",
                "changed"
              ]
            },
            "path": {
              "type": "string",
              "description": "JSON pointer to the changed location."
            },
            "breaking": {
              "type": "boolean"
            },
            "description": {
              "type": "string"
            }
          }
        }
      }
    }
  }
  ```

  </details>

---

### propose-agent-policy

Detect missing or inconsistent x-agent policies via LLM.

Analyzes CLI contract commands and proposes x-agent execution policies (riskLevel, requiresConfirmation, sideEffects, etc.) for commands that lack them. Uses agent-contracts-runtime as an optional peer dependency for LLM integration. Overlaps with "audit --checks agent-policy"; prefer audit for comprehensive review, this command for focused policy generation.

**Usage:**

```
cli-contracts propose-agent-policy cli-contract.yaml
```
```
cli-contracts propose-agent-policy --file cli-contract.yaml --adapter mock --show-prompt
```
```
cli-contracts propose-agent-policy --file cli-contract.yaml --adapter gemini --format json
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `contract` | No | Contract file to analyze. Mutually exclusive with --file; positional argument takes precedence if both are provided. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file to analyze (alternative to positional argument). |
| `--adapter` |  | No |  | LLM adapter to use. |
| `--model` |  | No |  | Model name to pass to the adapter. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the audit report. |

#### Exit Codes

**Exit 0:** Completed without blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid input or configuration.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation/parse failed.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### audit

Semantic audit of CLI contract design quality.

Performs a comprehensive audit of CLI contract design quality including responsibility boundaries, exit code consistency, output schema coverage, and AI-agent safety metadata. Uses agent-contracts-runtime as an optional peer dependency.

**Usage:**

```
cli-contracts audit cli-contract.yaml
```
```
cli-contracts audit --file cli-contract.yaml --checks agent-policy
```
```
cli-contracts audit --file cli-contract.yaml --adapter claude --show-prompt
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `contract` | No | Contract file to audit. Mutually exclusive with --file; positional argument takes precedence if both are provided. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file to audit (alternative to positional argument). |
| `--checks` |  | No |  | Audit dimension(s) to run. |
| `--adapter` |  | No |  | LLM adapter to use. |
| `--model` |  | No |  | Model name to pass to the adapter. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the audit report. |

#### Exit Codes

**Exit 0:** Completed without blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid input or configuration.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation/parse failed.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### extract

Extract a subset of the contract for specific commands.

Extracts one or more commands from a contract file, resolving all $ref references inline. Useful for feeding a focused contract subset to AI agents or external tooling.

**Usage:**

```
cli-contracts extract init validate
```
```
cli-contracts extract --file cli-contract.yaml init
```
```
cli-contracts extract --all
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `commands` *(variadic)* | No | Command ID(s) to extract. Use dot notation for nested commands (e.g. users.import). If omitted, --all must be specified. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file to extract from. Defaults to config input.files. |
| `--all` | -a | No | `false` | Extract all commands. |
| `--include-meta` |  | No | `true` | Include extraction metadata (source, timestamp, etc.). |

#### Exit Codes

**Exit 0:** Extraction succeeded.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `_meta` | `object` | No |  |
  | `_meta.source` | `string` | Yes | Path to the source contract file. |
  | `_meta.type` | `string` | Yes |  |
  | `_meta.extractedAt` | `string (format: date-time)` | Yes | ISO 8601 timestamp of extraction. |
  | `_meta.specVersion` | `string` | No | CLI Contracts spec version from the source. |
  | `_meta.commands` | `string[]` | Yes | List of command IDs that were extracted. |
  | `cli_contracts` | `string` | Yes | Spec version from the source contract. |
  | `info` | `object` | Yes | Info block from the source contract. |
  | `command_sets` | `object` | Yes | Subset of command sets containing only the requested commands. |
  | `components` | `object` | No | Only the schemas referenced by extracted commands. |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "cli_contracts",
      "info",
      "command_sets"
    ],
    "description": "A self-contained contract subset with all $ref resolved inline. When --include-meta is true, a _meta property is included.",
    "properties": {
      "_meta": {
        "type": "object",
        "required": [
          "source",
          "type",
          "extractedAt",
          "commands"
        ],
        "properties": {
          "source": {
            "type": "string",
            "description": "Path to the source contract file."
          },
          "type": {
            "type": "string",
            "const": "cli-contracts/extract"
          },
          "extractedAt": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 timestamp of extraction."
          },
          "specVersion": {
            "type": "string",
            "description": "CLI Contracts spec version from the source."
          },
          "commands": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "List of command IDs that were extracted."
          }
        }
      },
      "cli_contracts": {
        "type": "string",
        "description": "Spec version from the source contract."
      },
      "info": {
        "type": "object",
        "description": "Info block from the source contract."
      },
      "command_sets": {
        "type": "object",
        "description": "Subset of command sets containing only the requested commands."
      },
      "components": {
        "type": "object",
        "description": "Only the schemas referenced by extracted commands."
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid arguments (no commands specified and --all not set).

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation failed.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `valid` | `boolean` | Yes |  |
  | `errorCount` | `integer (min: 0)` | Yes |  |
  | `warningCount` | `integer (min: 0)` | Yes |  |
  | `errors` | `object[]` | Yes |  |
  | `errors[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `errors[].message` | `string` | Yes |  |
  | `errors[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `errors[].severity` | `"error" \| "warning"` | No |  |
  | `warnings` | `object[]` | Yes |  |
  | `warnings[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
  | `warnings[].message` | `string` | Yes |  |
  | `warnings[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
  | `warnings[].severity` | `"error" \| "warning"` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "valid",
      "errorCount",
      "warningCount",
      "errors",
      "warnings"
    ],
    "properties": {
      "valid": {
        "type": "boolean"
      },
      "errorCount": {
        "type": "integer",
        "minimum": 0
      },
      "warningCount": {
        "type": "integer",
        "minimum": 0
      },
      "errors": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      },
      "warnings": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "path",
            "message",
            "rule"
          ],
          "properties": {
            "path": {
              "type": "string",
              "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
            },
            "message": {
              "type": "string"
            },
            "rule": {
              "type": "string",
              "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
            },
            "severity": {
              "type": "string",
              "enum": [
                "error",
                "warning"
              ]
            }
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 8:** One or more requested commands not found.

- **stdout:** format=`yaml`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `_meta` | `object` | No |  |
  | `_meta.source` | `string` | Yes | Path to the source contract file. |
  | `_meta.type` | `string` | Yes |  |
  | `_meta.extractedAt` | `string (format: date-time)` | Yes | ISO 8601 timestamp of extraction. |
  | `_meta.specVersion` | `string` | No | CLI Contracts spec version from the source. |
  | `_meta.commands` | `string[]` | Yes | List of command IDs that were extracted. |
  | `cli_contracts` | `string` | Yes | Spec version from the source contract. |
  | `info` | `object` | Yes | Info block from the source contract. |
  | `command_sets` | `object` | Yes | Subset of command sets containing only the requested commands. |
  | `components` | `object` | No | Only the schemas referenced by extracted commands. |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "cli_contracts",
      "info",
      "command_sets"
    ],
    "description": "A self-contained contract subset with all $ref resolved inline. When --include-meta is true, a _meta property is included.",
    "properties": {
      "_meta": {
        "type": "object",
        "required": [
          "source",
          "type",
          "extractedAt",
          "commands"
        ],
        "properties": {
          "source": {
            "type": "string",
            "description": "Path to the source contract file."
          },
          "type": {
            "type": "string",
            "const": "cli-contracts/extract"
          },
          "extractedAt": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 timestamp of extraction."
          },
          "specVersion": {
            "type": "string",
            "description": "CLI Contracts spec version from the source."
          },
          "commands": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "List of command IDs that were extracted."
          }
        }
      },
      "cli_contracts": {
        "type": "string",
        "description": "Spec version from the source contract."
      },
      "info": {
        "type": "object",
        "description": "Info block from the source contract."
      },
      "command_sets": {
        "type": "object",
        "description": "Subset of command sets containing only the requested commands."
      },
      "components": {
        "type": "object",
        "description": "Only the schemas referenced by extracted commands."
      }
    }
  }
  ```

  </details>

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### propose-tests

Propose contract test cases via LLM analysis.

Analyzes CLI contract definitions and proposes test cases covering normal, error, edge, and safety scenarios. Generates test case YAML drafts or an AgentAuditResult with coverage-oriented findings.

**Usage:**

```
cli-contracts propose-tests cli-contract.yaml
```
```
cli-contracts propose-tests --file cli-contract.yaml --adapter gemini
```
```
cli-contracts propose-tests --file cli-contract.yaml --show-prompt
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `contract` | No | Contract file to analyze. Mutually exclusive with --file; positional argument takes precedence if both are provided. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file to analyze (alternative to positional argument). |
| `--adapter` |  | No |  | LLM adapter to use. |
| `--model` |  | No |  | Model name to pass to the adapter. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the audit report. |

#### Exit Codes

**Exit 0:** Completed without blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid input or configuration.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation/parse failed.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### explain-diff

Explain contract diff in human- and agent-readable form.

Takes a diff result (from cli-contracts diff) and generates human-friendly explanations including breaking change impact, migration notes, semver suggestions, and release note drafts. At least one input pair must be provided: either positional arguments (old new) or --base/--head options.

**Usage:**

```
cli-contracts explain-diff old.yaml new.yaml
```
```
cli-contracts explain-diff --base main --head HEAD --adapter gemini
```
```
cli-contracts explain-diff old.yaml new.yaml --show-prompt
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `old` | No | Path to the old (base) contract file. |
| `new` | No | Path to the new (head) contract file. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--base` |  | No |  | Git ref for the base version. |
| `--head` |  | No |  | Git ref for the head version. |
| `--contract-path` | -p | No | `"cli-contract.yaml"` | Contract file path within the repository (used with --base/--head). |
| `--adapter` |  | No |  | LLM adapter to use. |
| `--model` |  | No |  | Model name to pass to the adapter. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the audit report. |

#### Exit Codes

**Exit 0:** Completed without blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid input or configuration.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation/parse failed.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 10:** Completed with blocking findings.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### check-reference

Check LLM command conformance against the reference specification.

Verifies whether LLM-powered commands in a target cli-contract.yaml conform to the cli-contracts reference specification. Checks standard option sets, exit codes, x-agent metadata, output schema conformance to the agent-contracts canonical audit result schema (via $ref or compatible inline definition), and agent-evidence base properties. Performs deterministic pre-analysis and uses LLM for semantic evaluation of overall conformance quality.

**Usage:**

```
cli-contracts check-reference path/to/cli-contract.yaml
```
```
cli-contracts check-reference --file path/to/cli-contract.yaml --adapter openai
```
```
cli-contracts check-reference --file path/to/cli-contract.yaml --show-prompt
```

#### Arguments

| Name | Required | Description |
|---|---|---|
| `contract` | No | Contract file to check. Mutually exclusive with --file; positional argument takes precedence if both are provided. |

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--file` | -f | No |  | Contract file to check (alternative to positional argument). |
| `--adapter` |  | No |  | LLM adapter to use. |
| `--model` |  | No |  | Model name to pass to the adapter. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the conformance report. |

#### Exit Codes

**Exit 0:** All LLM commands conform to the reference specification.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid input or configuration.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation/parse failed.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 10:** Conformance issues found above --fail-on threshold.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

### suggest

Generate a contract draft from existing CLI sources.

Generates a cli-contract.yaml draft from existing CLI sources such as README, --help output, or source code. Results require human review before adoption. At least one --from-* option must be provided.

**Usage:**

```
cli-contracts suggest --from-readme README.md
```
```
cli-contracts suggest --from-help help.txt
```
```
cli-contracts suggest --from-source src/cli.ts
```
```
cli-contracts suggest --from-readme README.md --adapter gemini
```

#### Options

| Option | Aliases | Required | Default | Description |
|---|---|---|---|---|
| `--from-readme` |  | No |  | Path to a README file to extract CLI information from. |
| `--from-help` |  | No |  | Path to a file containing --help output. |
| `--from-source` |  | No |  | Path to CLI source code file. |
| `--adapter` |  | No |  | LLM adapter to use. |
| `--model` |  | No |  | Model name to pass to the adapter. |
| `--fail-on` |  | No | `"error"` | Minimum severity that causes a non-zero exit. |
| `--output` | -o | No |  | Write result to a file instead of stdout. |
| `--report-format` |  | No | `"json"` | Output format for the suggestion report. |

#### Exit Codes

**Exit 0:** Suggestion generated successfully.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 1:** Unexpected error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 2:** Invalid input or no source specified.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 3:** Contract validation/parse failed.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 10:** Suggestion generated with blocking issues.

- **stdout:** format=`{options.report-format}`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `summary` | `string` | Yes |  |
  | `risk_level` | `"low" \| "medium" \| "high" \| "critical"` | Yes |  |
  | `findings` | `object[]` | Yes |  |
  | `findings[].id` | `string` | No | Unique finding identifier. |
  | `findings[].severity` | `"info" \| "warning" \| "error" \| "critical"` | Yes |  |
  | `findings[].category` | `string` | Yes | Finding category (e.g. missing-policy, inconsistent-risk). |
  | `findings[].target` | `string` | No | Target of the finding (command ID, schema path). |
  | `findings[].location` | `string` | No | Location within the target. |
  | `findings[].message` | `string` | Yes |  |
  | `findings[].recommendation` | `string` | No |  |
  | `findings[].confidence` | `number (min: 0, max: 1)` | No | Confidence score (0-1) for LLM-generated findings. |
  | `findings[].evidence` | `object[]` | No |  |
  | `findings[].evidence[].kind` | `enum(7 values)` | Yes |  |
  | `findings[].evidence[].target` | `string` | No | Target identifier (file path, command ID, schema name). |
  | `findings[].evidence[].location` | `string` | No | Location within the target (line number, JSON pointer). |
  | `findings[].evidence[].excerpt` | `string` | No | Relevant excerpt from the target. |
  | `findings[].details` | `Record<string, any>` | No |  |
  | `recommended_actions` | `object[]` | No |  |
  | `recommended_actions[].kind` | `enum(6 values)` | Yes |  |
  | `recommended_actions[].title` | `string` | Yes |  |
  | `recommended_actions[].command` | `string` | No | CLI command to run (for run_command kind). |
  | `recommended_actions[].target` | `string` | No | Target file or resource. |
  | `recommended_actions[].rationale` | `string` | No |  |
  | `metadata` | `object` | No |  |
  | `metadata.tool` | `string` | No |  |
  | `metadata.command` | `string` | No |  |
  | `metadata.version` | `string` | No |  |
  | `metadata.generated_at` | `string` | No |  |
  | `metadata.adapter` | `string` | No |  |
  | `metadata.model` | `string` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "description": "Top-level result from an agent audit. Canonical schema for agent interoperability across toolchains.",
    "required": [
      "summary",
      "risk_level",
      "findings"
    ],
    "properties": {
      "summary": {
        "type": "string"
      },
      "risk_level": {
        "type": "string",
        "enum": [
          "low",
          "medium",
          "high",
          "critical"
        ]
      },
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A single finding from an agent audit or analysis.",
          "required": [
            "severity",
            "category",
            "message"
          ],
          "properties": {
            "id": {
              "type": "string",
              "description": "Unique finding identifier."
            },
            "severity": {
              "type": "string",
              "enum": [
                "info",
                "warning",
                "error",
                "critical"
              ]
            },
            "category": {
              "type": "string",
              "description": "Finding category (e.g. missing-policy, inconsistent-risk)."
            },
            "target": {
              "type": "string",
              "description": "Target of the finding (command ID, schema path)."
            },
            "location": {
              "type": "string",
              "description": "Location within the target."
            },
            "message": {
              "type": "string"
            },
            "recommendation": {
              "type": "string"
            },
            "confidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 1,
              "description": "Confidence score (0-1) for LLM-generated findings."
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "object",
                "description": "Evidence supporting an agent finding.",
                "required": [
                  "kind"
                ],
                "properties": {
                  "kind": {
                    "type": "string",
                    "enum": [
                      "file",
                      "command",
                      "schema",
                      "diff",
                      "stdout",
                      "stderr",
                      "text"
                    ]
                  },
                  "target": {
                    "type": "string",
                    "description": "Target identifier (file path, command ID, schema name)."
                  },
                  "location": {
                    "type": "string",
                    "description": "Location within the target (line number, JSON pointer)."
                  },
                  "excerpt": {
                    "type": "string",
                    "description": "Relevant excerpt from the target."
                  }
                }
              }
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          }
        }
      },
      "recommended_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "description": "A recommended action from an agent audit.",
          "required": [
            "kind",
            "title"
          ],
          "properties": {
            "kind": {
              "type": "string",
              "enum": [
                "run_command",
                "edit_file",
                "review",
                "confirm",
                "block",
                "ignore"
              ]
            },
            "title": {
              "type": "string"
            },
            "command": {
              "type": "string",
              "description": "CLI command to run (for run_command kind)."
            },
            "target": {
              "type": "string",
              "description": "Target file or resource."
            },
            "rationale": {
              "type": "string"
            }
          }
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "tool": {
            "type": "string"
          },
          "command": {
            "type": "string"
          },
          "version": {
            "type": "string"
          },
          "generated_at": {
            "type": "string"
          },
          "adapter": {
            "type": "string"
          },
          "model": {
            "type": "string"
          }
        }
      }
    }
  }
  ```

  </details>

**Exit 11:** Runtime dependency missing (agent-contracts-runtime).

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

**Exit 12:** LLM provider or adapter error.

- **stderr:** format=`json`

  | Property | Type | Required | Description |
  |---|---|---|---|
  | `code` | `string` | Yes |  |
  | `message` | `string` | Yes |  |
  | `details` | `Record<string, any>` | No |  |

  <details>
  <summary>JSON Schema</summary>

  ```json
  {
    "type": "object",
    "required": [
      "code",
      "message"
    ],
    "properties": {
      "code": {
        "type": "string"
      },
      "message": {
        "type": "string"
      },
      "details": {
        "type": "object",
        "additionalProperties": true
      }
    }
  }
  ```

  </details>

---

---

## Schemas

### Error

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | Yes |  |
| `message` | `string` | Yes |  |
| `details` | `Record<string, any>` | No |  |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "code",
    "message"
  ],
  "properties": {
    "code": {
      "type": "string"
    },
    "message": {
      "type": "string"
    },
    "details": {
      "type": "object",
      "additionalProperties": true
    }
  }
}
```

</details>

### InitResult

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `contractFile` | `string` | Yes | Path to the generated cli-contract.yaml. |
| `configFile` | `string` | No | Path to the generated cli-contracts.config.yaml (if --with-config). |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "contractFile"
  ],
  "properties": {
    "contractFile": {
      "type": "string",
      "description": "Path to the generated cli-contract.yaml."
    },
    "configFile": {
      "type": "string",
      "description": "Path to the generated cli-contracts.config.yaml (if --with-config)."
    }
  }
}
```

</details>

### ValidateResult

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `valid` | `boolean` | Yes |  |
| `errorCount` | `integer (min: 0)` | Yes |  |
| `warningCount` | `integer (min: 0)` | Yes |  |
| `errors` | `object[]` | Yes |  |
| `errors[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
| `errors[].message` | `string` | Yes |  |
| `errors[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
| `errors[].severity` | `"error" \| "warning"` | No |  |
| `warnings` | `object[]` | Yes |  |
| `warnings[].path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
| `warnings[].message` | `string` | Yes |  |
| `warnings[].rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
| `warnings[].severity` | `"error" \| "warning"` | No |  |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "valid",
    "errorCount",
    "warningCount",
    "errors",
    "warnings"
  ],
  "properties": {
    "valid": {
      "type": "boolean"
    },
    "errorCount": {
      "type": "integer",
      "minimum": 0
    },
    "warningCount": {
      "type": "integer",
      "minimum": 0
    },
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "path",
          "message",
          "rule"
        ],
        "properties": {
          "path": {
            "type": "string",
            "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
          },
          "message": {
            "type": "string"
          },
          "rule": {
            "type": "string",
            "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
          },
          "severity": {
            "type": "string",
            "enum": [
              "error",
              "warning"
            ]
          }
        }
      }
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "path",
          "message",
          "rule"
        ],
        "properties": {
          "path": {
            "type": "string",
            "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
          },
          "message": {
            "type": "string"
          },
          "rule": {
            "type": "string",
            "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
          },
          "severity": {
            "type": "string",
            "enum": [
              "error",
              "warning"
            ]
          }
        }
      }
    }
  }
}
```

</details>

### Diagnostic

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init). |
| `message` | `string` | Yes |  |
| `rule` | `string` | Yes | Validation rule ID (e.g. duplicate-command-id, invalid-exit-code). |
| `severity` | `"error" \| "warning"` | No |  |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "path",
    "message",
    "rule"
  ],
  "properties": {
    "path": {
      "type": "string",
      "description": "JSON pointer to the problematic location (e.g. /commandSets/foo/commands/init)."
    },
    "message": {
      "type": "string"
    },
    "rule": {
      "type": "string",
      "description": "Validation rule ID (e.g. duplicate-command-id, invalid-exit-code)."
    },
    "severity": {
      "type": "string",
      "enum": [
        "error",
        "warning"
      ]
    }
  }
}
```

</details>

### GenerateResult

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `generators` | `object[]` | Yes |  |
| `generators[].name` | `string` | Yes | Generator name (e.g. typescript, rust, markdown). |
| `generators[].status` | `"success" \| "skipped" \| "failed"` | Yes |  |
| `generators[].files` | `string[]` | Yes | List of generated file paths. |
| `generators[].error` | `string` | No | Error message if status is failed. |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "generators"
  ],
  "properties": {
    "generators": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "name",
          "status",
          "files"
        ],
        "properties": {
          "name": {
            "type": "string",
            "description": "Generator name (e.g. typescript, rust, markdown)."
          },
          "status": {
            "type": "string",
            "enum": [
              "success",
              "skipped",
              "failed"
            ]
          },
          "files": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "List of generated file paths."
          },
          "error": {
            "type": "string",
            "description": "Error message if status is failed."
          }
        }
      }
    }
  }
}
```

</details>

### GeneratorOutput

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Generator name (e.g. typescript, rust, markdown). |
| `status` | `"success" \| "skipped" \| "failed"` | Yes |  |
| `files` | `string[]` | Yes | List of generated file paths. |
| `error` | `string` | No | Error message if status is failed. |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "name",
    "status",
    "files"
  ],
  "properties": {
    "name": {
      "type": "string",
      "description": "Generator name (e.g. typescript, rust, markdown)."
    },
    "status": {
      "type": "string",
      "enum": [
        "success",
        "skipped",
        "failed"
      ]
    },
    "files": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of generated file paths."
    },
    "error": {
      "type": "string",
      "description": "Error message if status is failed."
    }
  }
}
```

</details>

### TestResult

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `total` | `integer (min: 0)` | Yes |  |
| `passed` | `integer (min: 0)` | Yes |  |
| `failed` | `integer (min: 0)` | Yes |  |
| `skipped` | `integer (min: 0)` | Yes |  |
| `durationMs` | `integer (min: 0)` | No |  |
| `cases` | `object[]` | Yes |  |
| `cases[].id` | `string` | Yes | Test case ID. |
| `cases[].status` | `"passed" \| "failed" \| "skipped"` | Yes |  |
| `cases[].durationMs` | `integer (min: 0)` | No |  |
| `cases[].violations` | `object[]` | No |  |
| `cases[].violations[].type` | `enum(7 values)` | Yes |  |
| `cases[].violations[].message` | `string` | Yes |  |
| `cases[].violations[].expected` | `any` | No | Expected value or schema excerpt. |
| `cases[].violations[].actual` | `any` | No | Actual value received. |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "total",
    "passed",
    "failed",
    "skipped",
    "cases"
  ],
  "properties": {
    "total": {
      "type": "integer",
      "minimum": 0
    },
    "passed": {
      "type": "integer",
      "minimum": 0
    },
    "failed": {
      "type": "integer",
      "minimum": 0
    },
    "skipped": {
      "type": "integer",
      "minimum": 0
    },
    "durationMs": {
      "type": "integer",
      "minimum": 0
    },
    "cases": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "status"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "Test case ID."
          },
          "status": {
            "type": "string",
            "enum": [
              "passed",
              "failed",
              "skipped"
            ]
          },
          "durationMs": {
            "type": "integer",
            "minimum": 0
          },
          "violations": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "type",
                "message"
              ],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "exit_code_mismatch",
                    "stdout_schema_mismatch",
                    "stderr_schema_mismatch",
                    "stdout_format_mismatch",
                    "stderr_format_mismatch",
                    "file_missing",
                    "file_schema_mismatch"
                  ]
                },
                "message": {
                  "type": "string"
                },
                "expected": {
                  "description": "Expected value or schema excerpt."
                },
                "actual": {
                  "description": "Actual value received."
                }
              }
            }
          }
        }
      }
    }
  }
}
```

</details>

### TestCaseResult

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Test case ID. |
| `status` | `"passed" \| "failed" \| "skipped"` | Yes |  |
| `durationMs` | `integer (min: 0)` | No |  |
| `violations` | `object[]` | No |  |
| `violations[].type` | `enum(7 values)` | Yes |  |
| `violations[].message` | `string` | Yes |  |
| `violations[].expected` | `any` | No | Expected value or schema excerpt. |
| `violations[].actual` | `any` | No | Actual value received. |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "id",
    "status"
  ],
  "properties": {
    "id": {
      "type": "string",
      "description": "Test case ID."
    },
    "status": {
      "type": "string",
      "enum": [
        "passed",
        "failed",
        "skipped"
      ]
    },
    "durationMs": {
      "type": "integer",
      "minimum": 0
    },
    "violations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "type",
          "message"
        ],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "exit_code_mismatch",
              "stdout_schema_mismatch",
              "stderr_schema_mismatch",
              "stdout_format_mismatch",
              "stderr_format_mismatch",
              "file_missing",
              "file_schema_mismatch"
            ]
          },
          "message": {
            "type": "string"
          },
          "expected": {
            "description": "Expected value or schema excerpt."
          },
          "actual": {
            "description": "Actual value received."
          }
        }
      }
    }
  }
}
```

</details>

### ContractViolation

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `enum(7 values)` | Yes |  |
| `message` | `string` | Yes |  |
| `expected` | `any` | No | Expected value or schema excerpt. |
| `actual` | `any` | No | Actual value received. |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "type",
    "message"
  ],
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "exit_code_mismatch",
        "stdout_schema_mismatch",
        "stderr_schema_mismatch",
        "stdout_format_mismatch",
        "stderr_format_mismatch",
        "file_missing",
        "file_schema_mismatch"
      ]
    },
    "message": {
      "type": "string"
    },
    "expected": {
      "description": "Expected value or schema excerpt."
    },
    "actual": {
      "description": "Actual value received."
    }
  }
}
```

</details>

### ExtractResult

A self-contained contract subset with all $ref resolved inline. When --include-meta is true, a _meta property is included.

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `_meta` | `object` | No |  |
| `_meta.source` | `string` | Yes | Path to the source contract file. |
| `_meta.type` | `string` | Yes |  |
| `_meta.extractedAt` | `string (format: date-time)` | Yes | ISO 8601 timestamp of extraction. |
| `_meta.specVersion` | `string` | No | CLI Contracts spec version from the source. |
| `_meta.commands` | `string[]` | Yes | List of command IDs that were extracted. |
| `cli_contracts` | `string` | Yes | Spec version from the source contract. |
| `info` | `object` | Yes | Info block from the source contract. |
| `command_sets` | `object` | Yes | Subset of command sets containing only the requested commands. |
| `components` | `object` | No | Only the schemas referenced by extracted commands. |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "cli_contracts",
    "info",
    "command_sets"
  ],
  "description": "A self-contained contract subset with all $ref resolved inline. When --include-meta is true, a _meta property is included.",
  "properties": {
    "_meta": {
      "type": "object",
      "required": [
        "source",
        "type",
        "extractedAt",
        "commands"
      ],
      "properties": {
        "source": {
          "type": "string",
          "description": "Path to the source contract file."
        },
        "type": {
          "type": "string",
          "const": "cli-contracts/extract"
        },
        "extractedAt": {
          "type": "string",
          "format": "date-time",
          "description": "ISO 8601 timestamp of extraction."
        },
        "specVersion": {
          "type": "string",
          "description": "CLI Contracts spec version from the source."
        },
        "commands": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of command IDs that were extracted."
        }
      }
    },
    "cli_contracts": {
      "type": "string",
      "description": "Spec version from the source contract."
    },
    "info": {
      "type": "object",
      "description": "Info block from the source contract."
    },
    "command_sets": {
      "type": "object",
      "description": "Subset of command sets containing only the requested commands."
    },
    "components": {
      "type": "object",
      "description": "Only the schemas referenced by extracted commands."
    }
  }
}
```

</details>

### ExtractMeta

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `source` | `string` | Yes | Path to the source contract file. |
| `type` | `string` | Yes |  |
| `extractedAt` | `string (format: date-time)` | Yes | ISO 8601 timestamp of extraction. |
| `specVersion` | `string` | No | CLI Contracts spec version from the source. |
| `commands` | `string[]` | Yes | List of command IDs that were extracted. |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "source",
    "type",
    "extractedAt",
    "commands"
  ],
  "properties": {
    "source": {
      "type": "string",
      "description": "Path to the source contract file."
    },
    "type": {
      "type": "string",
      "const": "cli-contracts/extract"
    },
    "extractedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of extraction."
    },
    "specVersion": {
      "type": "string",
      "description": "CLI Contracts spec version from the source."
    },
    "commands": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "List of command IDs that were extracted."
    }
  }
}
```

</details>

### DiffResult

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `hasBreakingChanges` | `boolean` | Yes |  |
| `breakingCount` | `integer (min: 0)` | No |  |
| `nonBreakingCount` | `integer (min: 0)` | No |  |
| `changes` | `object[]` | Yes |  |
| `changes[].type` | `"added" \| "removed" \| "changed"` | Yes |  |
| `changes[].path` | `string` | Yes | JSON pointer to the changed location. |
| `changes[].breaking` | `boolean` | Yes |  |
| `changes[].description` | `string` | Yes |  |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "hasBreakingChanges",
    "changes"
  ],
  "properties": {
    "hasBreakingChanges": {
      "type": "boolean"
    },
    "breakingCount": {
      "type": "integer",
      "minimum": 0
    },
    "nonBreakingCount": {
      "type": "integer",
      "minimum": 0
    },
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "type",
          "path",
          "breaking",
          "description"
        ],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "added",
              "removed",
              "changed"
            ]
          },
          "path": {
            "type": "string",
            "description": "JSON pointer to the changed location."
          },
          "breaking": {
            "type": "boolean"
          },
          "description": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

</details>

### DiffChange

Type: `object`

| Property | Type | Required | Description |
|---|---|---|---|
| `type` | `"added" \| "removed" \| "changed"` | Yes |  |
| `path` | `string` | Yes | JSON pointer to the changed location. |
| `breaking` | `boolean` | Yes |  |
| `description` | `string` | Yes |  |

<details>
<summary>JSON Schema</summary>

```json
{
  "type": "object",
  "required": [
    "type",
    "path",
    "breaking",
    "description"
  ],
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "added",
        "removed",
        "changed"
      ]
    },
    "path": {
      "type": "string",
      "description": "JSON pointer to the changed location."
    },
    "breaking": {
      "type": "boolean"
    },
    "description": {
      "type": "string"
    }
  }
}
```

</details>
