# Handoff schema の canonical ownership を agent-contracts に移す

**Version**: 0.1.0
**Date**: 2026-05-11
**Status**: Phase 1 (Deprecated marking) implemented

---

## 1. 背景

### 1.1 現状の課題

cli-contracts の `components.schemas` に `AgentAuditResult` / `AgentFinding` 等の handoff 相当 schema が定義されており、agent-contracts が参照する構造になっている。

```text
cli-contracts
  └─ components.schemas に AgentAuditResult / Handoff 相当 schema を定義
       ↓
agent-contracts が参照
```

しかし、handoff schema は agent 間メッセージプロトコルであり、agent-contracts の `handoff_types` として管理するのが自然である。`agent-contracts` は README 上でも handoff type を inter-agent messages の schema として扱っている。

### 1.2 責務の不整合

現状の問題:

- handoff の意味論を持たない cli-contracts が、handoff schema の canonical owner になっている
- agent-contracts が外部パッケージの schema を参照する形になり、依存方向が逆転している
- 両方に同等の schema が存在するリスクがあり、drift が発生しやすい

---

## 2. 変更方針

### 2.1 目標

handoff の canonical owner を agent-contracts に戻しつつ、cli-contracts 側からは同じ schema を安全に参照できるようにする。

### 2.2 変更後の構造

```text
agent-contracts
  └─ handoff_types / components.schemas を canonical とする
       ↓
cli-contracts が agent-contracts 由来 schema を参照
```

### 2.3 責務分担

| 項目 | Canonical owner |
|---|---|
| agent 間 handoff schema | agent-contracts |
| CLI stdout / stderr の契約 | cli-contracts |
| CLI が handoff 互換 payload を返すこと | cli-contracts が contract として宣言 |
| `$ref` リンク切れの検出 | cli-contracts validate |
| agent-contracts.yaml の保護 | artifact-contracts |

---

## 3. agent-contracts 側の変更

### 3.1 `handoff_types` を canonical schema source にする

agent-contracts の `handoff_types` を、CLI からも参照可能な canonical schema として扱う。

```yaml
# agent-contracts.yaml
components:
  schemas:
    finding:
      type: object
      required: [severity, message]
      properties:
        severity:
          type: string
          enum: [critical, warning, info]
        message:
          type: string
        target:
          type: string
        evidence:
          type: array
          items:
            type: object

    audit-result-payload:
      type: object
      required: [summary, riskLevel, findings]
      properties:
        summary:
          type: string
        riskLevel:
          type: string
          enum: [low, medium, high, critical]
        findings:
          type: array
          items:
            $ref: "#/components/schemas/finding"

handoff_types:
  audit-result:
    version: 1
    description: "Audit result returned from tool/agent execution."
    schema:
      allOf:
        - $ref: "#/components/schemas/handoff-common"
        - type: object
          required: [payload]
          properties:
            payload:
              $ref: "#/components/schemas/audit-result-payload"

  task-delegation:
    version: 1
    description: "Delegate a task to an agent."
    schema:
      allOf:
        - $ref: "#/components/schemas/handoff-common"
        - type: object
          required: [payload]
          properties:
            payload:
              type: object
              required: [objective]
              properties:
                objective:
                  type: string
                constraints:
                  type: array
                  items:
                    type: string
```

### 3.2 参照方式

cli-contract.yaml から agent-contracts.yaml 内の schema を直接 `$ref` で参照する。中間ファイルの生成は不要。

```yaml
# cli-contract.yaml
commands:
  audit:
    exits:
      '0':
        stdout:
          format: json
          schema:
            $ref: "./agent-contracts.yaml#/components/schemas/audit-result-payload"
```

`$ref` は `ファイルパス#/JSON Pointer` 形式（JSON Reference / JSON Schema 標準）であり、同一リポジトリ内であればファイルパスは安定している。

リンク切れは `cli-contracts validate --resolve-refs` で検出できる。`--resolve-refs` はデフォルト `true` のため、通常の validate 実行でリンク切れが検出される。

---

## 4. cli-contracts 側の変更

### 4.1 `components.schemas` に handoff 本体を定義しない

**変更前:**

```yaml
# cli-contract.yaml
components:
  schemas:
    AgentAuditResult:
      type: object
      required: [summary, riskLevel, findings]
      properties:
        summary:
          type: string
        riskLevel:
          type: string
        findings:
          type: array
```

**変更後:**

```yaml
# cli-contract.yaml
commands:
  audit:
    summary: Run semantic audit.
    exits:
      '0':
        description: Audit completed.
        stdout:
          format: json
          schema:
            $ref: "./agent-contracts.yaml#/components/schemas/audit-result-payload"
```

cli-contracts は「この CLI の stdout は audit-result handoff schema に準拠する」とだけ定義する。

### 4.2 CLI 用 envelope が必要な場合は wrapper schema を cli-contracts 側に置く

CLI の出力が agent handoff そのものではなく、CLI metadata を持つ場合がある。

```json
{
  "tool": "micro-contracts",
  "command": "audit",
  "version": "0.15.0",
  "result": {
    "from_agent": "contract-auditor",
    "to_agent": "architect",
    "payload": {
      "summary": "...",
      "riskLevel": "medium",
      "findings": []
    }
  }
}
```

この場合、handoff payload 本体は agent-contracts、CLI wrapper は cli-contracts が持つ。

```yaml
# cli-contract.yaml
components:
  schemas:
    CliAuditEnvelope:
      type: object
      required: [tool, command, result]
      properties:
        tool:
          type: string
        command:
          type: string
        version:
          type: string
        result:
          $ref: "./agent-contracts.yaml#/handoff_types/audit-result/schema"

commands:
  audit:
    exits:
      '0':
        stdout:
          format: json
          schema:
            $ref: "#/components/schemas/CliAuditEnvelope"
```

責務の分離:

```text
handoff の意味論 = agent-contracts
CLI 出力の包み方 = cli-contracts
```

---

## 5. artifact-contracts 側の扱い

artifact-contracts では、agent-contracts.yaml を canonical source として登録し、cli-contract.yaml がそこから `$ref` で参照していることを追跡できる。

```yaml
# artifact-contracts.yaml
artifacts:
  agent-contracts-yaml:
    type: schema
    description: "Canonical handoff schema definitions (handoff_types, components.schemas)."
    authority: canonical
    protected: true
    scope:
      kind: file
      path_patterns:
        - "agent-contracts.yaml"
```

artifact-contracts は handoff の意味を管理しない。schema ファイルの保護と、参照関係の追跡を担当する。中間生成ファイルは存在しないため、drift check は不要。cli-contract.yaml からの `$ref` リンク切れは `cli-contracts validate` で検出する。

---

## 6. 互換性維持のための移行仕様

### Phase 1: cli-contracts 側の既存 schema を deprecated 扱いにする

cli-contracts の既存 schema はすぐ削除せず、deprecated にする。

```yaml
components:
  schemas:
    AgentAuditResult:
      x-deprecated: true
      x-replaced-by: "agent-contracts:handoff_types.audit-result"
      type: object
      ...
```

`cli-contracts validate` では warning を出す。

```text
warning deprecated-schema-source:
  components.schemas.AgentAuditResult is deprecated.
  Define handoff schema in agent-contracts and reference exported schema instead.
```

### Phase 2: cli-contracts が agent-contracts.yaml を直接参照

cli-contracts 側では、stdout schema を agent-contracts.yaml への `$ref` に差し替える。

```yaml
stdout:
  format: json
  schema:
    $ref: "./agent-contracts.yaml#/components/schemas/audit-result-payload"
```

`cli-contracts validate` を実行し、`$ref` が正しく解決されることを確認する。

### Phase 3: cli-contracts から handoff schema 定義を削除

十分に移行できたら、cli-contracts 側の重複 schema を削除する。

---

## 7. 追加する validation rule

### 7.1 agent-contracts 側

**`handoff-schema-jsonschema-valid`**

各 handoff type の `schema` が JSON Schema として妥当であることを検証する。既存の handoff schema meta-validation の拡張でよい。

### 7.2 cli-contracts 側

**`external-schema-ref-valid`**

`stdout.schema.$ref` が外部ファイルを指している場合、そのファイルが存在し、JSON Schema として妥当であることを検証する。

**`handoff-schema-source-warning`**

cli-contracts の `components.schemas` に handoff 由来 schema が定義されている場合、warning を出す。

判定方法は完全自動だと難しいので、明示メタデータを使う。

```yaml
components:
  schemas:
    AgentAuditResult:
      x-schema-source: handoff
```

この場合:

```text
warning:
  Handoff schema should be defined in agent-contracts and referenced from cli-contracts.
```

---

## 8. 推奨する最終形

### 8.1 ファイル構成

```text
agent-contracts.yaml
  - handoff_types          (canonical handoff schema)
  - components.schemas     (共有 schema 定義)
  - workflow protocol

cli-contract.yaml
  - CLI command contract
  - stdout/stderr schema は agent-contracts.yaml を $ref で直接参照

artifact-contracts.yaml
  - agent-contracts.yaml を canonical source として保護
```

### 8.2 依存関係

```text
agent-contracts.yaml
  ↑               ↑
  |               |
cli-contract.yaml artifact-contracts.yaml
$ref で参照       保護・追跡
```

中間生成ファイルがないため、構造がシンプルで循環依存も発生しない。

---

## 9. 仕様文面案

README / design doc 向け:

> ### Handoff schema ownership
>
> Handoff schemas are owned by agent-contracts.
>
> agent-contracts defines inter-agent message protocols through `handoff_types`.
> When a CLI command returns a payload that is intended to be consumed as an agent handoff, cli-contracts must reference the schema in agent-contracts.yaml via `$ref` instead of redefining the handoff schema in `components.schemas`.
>
> cli-contracts remains responsible for the CLI interface contract, including command arguments, options, exit codes, stdout/stderr formats, and any CLI-specific envelope schema. Broken `$ref` links are detected by `cli-contracts validate --resolve-refs`.
>
> artifact-contracts may track agent-contracts.yaml as a canonical source for protection purposes, but it does not own the handoff protocol semantics.

日本語版:

> ### Handoff schema の所有権
>
> handoff schema は agent-contracts が所有する。
>
> agent-contracts は `handoff_types` によって agent 間メッセージプロトコルを定義する。CLI コマンドが agent handoff として消費される payload を返す場合、cli-contracts は同等の schema を `components.schemas` に再定義せず、agent-contracts.yaml 内の schema を `$ref` で直接参照する。
>
> cli-contracts は引き続き CLI インターフェース契約を所有する。これには command、arguments、options、exit codes、stdout/stderr format、CLI 固有 envelope schema が含まれる。`$ref` のリンク切れは `cli-contracts validate --resolve-refs` で検出する。
>
> artifact-contracts は agent-contracts.yaml を canonical source として保護の対象にできるが、handoff protocol の意味論は所有しない。

---

## 10. 実装タスク

### 10.1 agent-contracts

- `handoff_types` および `components.schemas` に handoff schema を canonical 定義する
- `handoff-schema-jsonschema-valid` validation rule を追加（各 handoff type の schema が JSON Schema として妥当であることを検証）

### 10.2 cli-contracts

- 外部ファイルへの `$ref` 解決が `validate --resolve-refs` で正しく動作することを確認・強化
- `external-schema-ref-valid` validation rule を追加（外部 `$ref` 先の存在と妥当性を検証）
- `handoff-schema-source-warning` validation rule を追加（`x-schema-source: handoff` がある schema に対して warning）
- 既存 `AgentAuditResult` 等に deprecated metadata (`x-deprecated`, `x-replaced-by`) を追加
- stdout/stderr schema の `$ref` を agent-contracts.yaml への直接参照に差し替え
- docs に「agent handoff schema は agent-contracts.yaml を直接参照する」方針を追記

### 10.3 artifact-contracts

- agent-contracts.yaml を canonical source として保護する artifact 定義例を追加

---

## 11. 判断

cli-contracts に入っている handoff 相当 schema を agent-contracts に移す。ただし、cli-contracts から完全に schema 参照をなくすのではなく、三層に分ける。

```text
agent-contracts.yaml:
  handoff protocol の canonical schema

cli-contract.yaml:
  CLI stdout/stderr が agent-contracts.yaml の schema に $ref で準拠することを宣言

artifact-contracts.yaml:
  agent-contracts.yaml を canonical source として保護
```

中間生成ファイルは不要。cli-contract.yaml から agent-contracts.yaml への `$ref` で直接参照し、リンク切れは `cli-contracts validate` で検出する。
