#!/usr/bin/env node
// Writes the version of package.json into every language runtime of the
// repository. With --check, writes nothing and exits 1 when one differs.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8")).version;

// Each file holds the version once, in the place the pattern matches.
const targets = [
  ["python/pyproject.toml", /^(version = ")([^"]+)(")$/m],
  ["python/cli_contracts_runtime/__init__.py", /^(__version__ = ")([^"]+)(")$/m],
  ["rust/cli_contracts_runtime/Cargo.toml", /^(version = ")([^"]+)(")$/m],
  ["rust/cli_contracts_runtime/src/lib.rs", /^(pub const VERSION: &str = ")([^"]+)(";)$/m],
  ["rust/Cargo.lock", /^(name = "cli_contracts_runtime"\nversion = ")([^"]+)(")$/m],
  ["go/cli_contracts_runtime/version.go", /^(const Version = ")([^"]+)(")$/m],
  ["php/src/Runtime.php", /^(    public const VERSION = ')([^']+)(';)$/m],
];

let mismatches = 0;
for (const [file, pattern] of targets) {
  const path = resolve(root, file);
  const text = readFileSync(path, "utf-8");
  const matches = text.match(new RegExp(pattern.source, "gm")) ?? [];
  if (matches.length !== 1) {
    console.error(`${file}: expected one version, found ${matches.length}`);
    process.exit(2);
  }
  const current = text.match(pattern)[2];
  if (current === version) {
    console.log(`${file}: ${current}`);
    continue;
  }
  if (check) {
    console.error(`${file}: ${current}, package.json: ${version}`);
    mismatches++;
    continue;
  }
  writeFileSync(path, text.replace(pattern, `$1${version}$3`));
  console.log(`${file}: ${current} -> ${version}`);
}
if (mismatches > 0) process.exit(1);
