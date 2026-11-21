// The Rust conformance programs: the generated module, a handler that writes
// what it receives, and a main that runs every invocation in one process.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateRust, rustHandlerSignature, rustSnake, rustString, rustType } from "../../../src/generators/rust.js";
import type { SpecCommand } from "../../../src/generators/runtime-spec.js";
import {
  FAILING_COMMAND,
  HANDLER_PREFIX,
  PROGRAM_VERSION,
  PROMPT_PREFIX,
  REPO,
  USAGE_PREFIX,
  type ConformanceContract,
} from "../shared.js";

function handlerMethod(cmd: SpecCommand): string {
  const lines = [`    ${rustHandlerSignature(cmd, "gen::")} {`];
  lines.push("        let mut args: Vec<rt::Value> = Vec::new();");
  for (const arg of cmd.arguments) {
    const name = rustSnake(arg.name);
    if (arg.variadic) lines.push(`        args.push(rt::Value::from(${name}.clone()));`);
    else if (arg.required) lines.push(`        args.push(rt::Value::from(${name}.clone()));`);
    else lines.push(`        args.push(${name}.clone().map(rt::Value::from).unwrap_or(rt::Value::Null));`);
  }
  lines.push("        let mut opts = rt::Object::new();");
  for (const opt of [...cmd.options].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
    lines.push(`        if let Some(v) = options.${rustSnake(opt.key)}.clone() {`);
    lines.push(`            opts.set(${rustString(opt.key)}, rt::Value::from(v));`);
    lines.push("        }");
  }
  lines.push(`        self.record(${rustString(cmd.id)}, args, opts, parent_opts);`);
  const code = cmd.id === FAILING_COMMAND.id ? FAILING_COMMAND.exitCode : 0;
  if (cmd.llm) {
    const first = cmd.arguments[0];
    const text = !first
      ? '"undefined".to_string()'
      : first.variadic
        ? `${rustSnake(first.name)}.join(",")`
        : first.required
          ? `${rustSnake(first.name)}.clone()`
          : `${rustSnake(first.name)}.clone().unwrap_or_else(|| "undefined".to_string())`;
    lines.push(`        (${code}, Some(format!("{}{}", ${rustString(PROMPT_PREFIX)}, ${text})))`);
  } else {
    lines.push(`        ${code}`);
  }
  lines.push("    }");
  return lines.join("\n");
}

function mainSource(c: ConformanceContract): string {
  const commands = [...new Map(c.spec.commands.map((cmd) => [cmd.id, cmd])).values()];
  const cases = c.argv.map((argv) => `        vec![${argv.map(rustString).join(", ")}],`).join("\n");
  return `#[path = "../../${c.name}/mod.rs"]
#[allow(dead_code)]
mod gen;

use std::cell::RefCell;
use std::io::Write;
use std::rc::Rc;

use cli_contracts_runtime as rt;
use gen::CommandHandlers;

#[derive(Clone, Default)]
struct Shared(Rc<RefCell<Vec<u8>>>);

impl Write for Shared {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0.borrow_mut().extend_from_slice(buf);
        Ok(buf.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Shared {
    fn take(&self) -> String {
        String::from_utf8(std::mem::take(&mut *self.0.borrow_mut())).expect("UTF-8")
    }
}

struct Handlers {
    stdout: Shared,
}

fn sorted(o: &rt::Object) -> rt::Object {
    let mut keys: Vec<&str> = o.keys().collect();
    keys.sort();
    let mut out = rt::Object::new();
    for k in keys {
        out.set(k, o.get(k).cloned().unwrap_or(rt::Value::Null));
    }
    out
}

impl Handlers {
    fn record(&mut self, id: &str, args: Vec<rt::Value>, opts: rt::Object, parent_opts: &rt::Object) {
        let line = rt::obj(vec![
            ("command", rt::Value::from(id)),
            ("args", rt::Value::Array(args)),
            ("opts", rt::Value::Object(opts)),
            ("globals", rt::Value::Object(sorted(parent_opts))),
        ]);
        let text = format!("{}{}\\n", ${rustString(HANDLER_PREFIX)}, rt::stringify(&line, 0));
        self.stdout.write_all(text.as_bytes()).expect("write");
    }
}

#[allow(unused_variables, unused_mut, clippy::vec_init_then_push, clippy::clone_on_copy)]
impl CommandHandlers for Handlers {
${commands.map(handlerMethod).join("\n\n")}
}

fn main() {
    let cases: Vec<Vec<&str>> = vec![
${cases}
    ];
    let mut results = rt::Object::new();
    for variant in ["plain", "usage"] {
        let stdout = Shared::default();
        let stderr = Shared::default();
        let mut options = rt::ProgramOptions::default();
        if variant == "usage" {
            let mut err_out = stderr.clone();
            options.on_usage_error = Some(Box::new(move |err: &rt::UsageError, command: &rt::Command| {
                let line = rt::obj(vec![
                    ("code", rt::Value::from(err.code)),
                    ("exitCode", rt::Value::from(err.exit_code)),
                    ("message", rt::Value::from(err.message.as_str())),
                    ("command", rt::Value::from(command.name)),
                ]);
                let text = format!("{}{}\\n", ${rustString(USAGE_PREFIX)}, rt::stringify(&line, 0));
                err_out.write_all(text.as_bytes()).expect("write");
                2
            }));
        }
        let mut program = gen::Program::new(Handlers { stdout: stdout.clone() }, ${rustString(PROGRAM_VERSION)}, options);
        let mut outcomes = Vec::new();
        for argv in &cases {
            let argv: Vec<String> = argv.iter().map(|s| s.to_string()).collect();
            let code = program.run(&argv, &mut stdout.clone(), &mut stderr.clone());
            outcomes.push(rt::obj(vec![
                ("exitCode", rt::Value::from(code)),
                ("stdout", rt::Value::from(stdout.take())),
                ("stderr", rt::Value::from(stderr.take())),
            ]));
        }
        results.set(variant, rt::Value::Array(outcomes));
    }
    let path = std::env::args().nth(1).expect("the results file");
    std::fs::write(path, rt::stringify(&rt::Value::Object(results), 0)).expect("write the results");
}
`;
}

export function prepareRust(contracts: ConformanceContract[], workDir: string): string {
  const bins = contracts.map((c) => `[[bin]]\nname = "${c.name}"\npath = "src/bin/${c.name}.rs"\n`).join("\n");
  writeFileSync(
    join(workDir, "Cargo.toml"),
    `[package]\nname = "conformance"\nversion = "0.0.0"\nedition = "2021"\npublish = false\n\n[workspace]\n\n[dependencies]\ncli_contracts_runtime = { path = ${JSON.stringify(join(REPO, "rust/cli_contracts_runtime"))} }\n\n${bins}`,
  );
  mkdirSync(join(workDir, "src/bin"), { recursive: true });
  const lines = [`cd ${JSON.stringify(workDir)}`];
  for (const c of contracts) {
    const dir = join(workDir, c.name);
    mkdirSync(dir, { recursive: true });
    for (const [file, content] of Object.entries(generateRust(c.ctx, { contractYaml: c.yaml }))) {
      writeFileSync(join(dir, file), content);
    }
    writeFileSync(join(workDir, "src/bin", `${c.name}.rs`), mainSource(c));
    lines.push(`rustfmt --edition 2021 --check ${c.name}/mod.rs`);
  }
  lines.push("cargo clippy --offline --bins -- -D warnings");
  for (const c of contracts) {
    lines.push(`cargo run --offline --quiet --bin ${c.name} ${JSON.stringify(join(workDir, `${c.name}.json`))}`);
  }
  return lines.join("\n");
}
