# Changelog

## 0.36.0

### 機能

- Go・Rust・Python・PHP の生成器を追加した（`builtin:go`・`builtin:rust`・`builtin:python`・`builtin:php`）。各言語の生成物は、TypeScript の生成物と同じく program（command の tree と handler の interface）・型・command wrapper・JSON Schema の定数・policy の導出・built-in `extract` を持つ。`builtin:go` は `options.package`、`builtin:php` は `options.namespace` を必須とする。
- 各言語の生成物が使う runtime を追加した。生成した program の argument・option の parse、validation の error、help の出力、exit code、`--introspect`・`--show-prompt`・`extract` の出力は、同じ契約から生成した TypeScript の program（commander）と一致する。runtime は第三者の依存を持たない。
  - Go: module `github.com/foo-log-inc/cli-contracts/go`（package `cli_contracts_runtime`、tag `go/v0.36.0`）
  - Rust: crate `cli_contracts_runtime`（crates.io）
  - Python: `cli-contracts-runtime`（PyPI、import 名 `cli_contracts_runtime`）
  - PHP: `cli-contracts/runtime`（namespace `CliContracts\Runtime`。Packagist には登録しない）
- 生成の仕様を、言語に依存しない model（`src/generators/cli-model.ts`・`commander-tree.ts`・`runtime-spec.ts`・`type-model.ts`）に集約した。TypeScript の生成器もこの model を描画する。
- `commander` を dependencies に移した（生成時に help を描画するため）。

### 挙動の変更

- TypeScript の生成器が出力する `program.ts` は、help を stdout・stderr が端末である場合も 80 桁で折り返す（`program.configureOutput({ getOutHelpWidth: () => 80, getErrHelpWidth: () => 80 })`。subcommand はこの設定を継承する）。これまでは、端末では端末の桁数で折り返していた。stdout・stderr が端末でない場合の出力は変わらない。help の出力を、ほかの言語の生成物と同一にするための変更である。

### 修正

- TypeScript の `types.ts` の `<Cmd>Options` は、repeatable な option を要素の型の配列（例: `rule?: ("strict" | "loose")[]`）とし、`commands.ts` の command wrapper は各値を flag と組にして渡す（`--rule strict --rule loose`）。これまでは単一の値の型とし、配列を渡すと `"strict,loose"` という 1 つの値になっていた。
- TypeScript の型は、配列の要素の型が複数の member を持つ場合に括弧を付ける（`("a" | "b")[]`）。これまでは `"a" | "b"[]` という別の型になっていた。
- 自身の action を持つ group（ほかの command が入れ子になる path の command）の後に登録した subcommand の help と、未知の option の候補が、その subcommand ではなく group の default subcommand の option を表示していた点を修正した。group の help だけが default subcommand の option を表示する。
- repeatable な option の `schema.default` を、生成した program は文字列のまま handler に渡していた点を修正した。default は要素が 1 つの配列（例: `["go"]`）として渡り、help は `(default: ["go"])` と表示する。値を指定した場合は、従来どおり指定した値だけが渡る。
- validator は、boolean の option の `schema.default` が true・false でない場合と、値を取る option の `schema.default` が true・false である場合を error（`option-default-type`）とする。これまでは、生成した program の handler が型と異なる値を受け取っていた。

## 0.35.4

### 挙動の変更（確認を要求する側への変更）

- 導出される policy の `requires_confirmation` は、コマンドと有効な各オプションのそれぞれの寄与の論理和とする。各寄与は、その元の `requires_confirmation` の明示値（無ければ、その元の `risk_level` が high 以上か）である。明示の `false` は、その元の寄与だけを下げ、ほかの元の確認の要求を打ち消さない。これまでは、最初に格納された明示値が全体に優先し、結果がオプションの宣言の順に依存していた。次の組み合わせは `false` から `true` に変わる。
  - コマンドが high 以上で、有効なオプションが `requires_confirmation: false` を明示する場合
  - コマンドが `requires_confirmation: false` を明示し、有効なオプションが high 以上か `requires_confirmation: true` を明示する場合
- 生成される policy（`commandDefinitions`・`deriveCommandPolicy`・`--introspect`）は、コマンドの option に加えて、command set の global option の effects・file を含める。global option だけに effects がある契約でも、policy と `--introspect` を生成する。
- LLM のコマンド（`audit`・`propose-agent-policy`・`propose-tests`・`explain-diff`・`check-reference`・`suggest`・`bundle`）は、runtime のタスクの結果が success でない場合（error・escalation・validation_error）、指摘なしの結果を出力せず、exit 12（LLM provider or adapter error）で終了する。

### 修正

- TypeScript の生成器は、契約の文字列の値（enum の値・option の名前・executable）を文字列のリテラルとして、識別子でないキー（properties・components.schemas・arguments の名前など）を引用したキーとして出力する。型・関数・変数の名前にならない契約の名前は、生成を失敗させる。
- 入れ子のコマンドの親の名前にハイフンを含む契約から生成した `program.ts` が、構文の誤りになっていた点を修正した。

### CI

- `npm-audit-remediate.yml` を、依存を実行する job（`contents: read`）と、lockfile の変更だけを受け入れて push・issue の作成を行う job（`contents: write`・`issues: write`）に分離した。
