# Changelog

## 0.36.0

### 挙動の変更

- TypeScript の生成器が出力する `program.ts` は、help を stdout・stderr が端末である場合も 80 桁で折り返す（`program.configureOutput({ getOutHelpWidth: () => 80, getErrHelpWidth: () => 80 })`。subcommand はこの設定を継承する）。これまでは、端末では端末の桁数で折り返していた。stdout・stderr が端末でない場合の出力は変わらない。help の出力を、ほかの言語の生成物と同一にするための変更である。

### 修正

- 自身の action を持つ group（ほかの command が入れ子になる path の command）の後に登録した subcommand の help と、未知の option の候補が、その subcommand ではなく group の default subcommand の option を表示していた点を修正した。group の help だけが default subcommand の option を表示する。

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
