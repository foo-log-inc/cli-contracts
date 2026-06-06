#!/usr/bin/env node
/**
 * Single-file bundle builder for cli-contracts CLI.
 *
 * Produces dist/cli-contracts.bundle.mjs — a self-contained CLI that only
 * requires Node.js 20+ and (optionally) the LLM SDK packages that are kept
 * external: @anthropic-ai/claude-agent-sdk, @google/adk, @openai/agents,
 * @google/genai.
 *
 * Usage:
 *   node esbuild.bundle.mjs            # normal bundle
 *   node esbuild.bundle.mjs --minify   # minified bundle
 */

import { build } from "esbuild";
import { readFileSync, statSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const minify = process.argv.includes("--minify");

const externalSdks = [
  "@anthropic-ai/claude-agent-sdk",
  "@anthropic-ai/sdk",
  "@google/adk",
  "@openai/agents",
  "@google/genai",
];

const resolveRuntimeDynamicImports = {
  name: "resolve-runtime-dynamic-imports",
  setup(_build) {},
};

/**
 * Plugin: inline build-time constants.
 *
 * - src/index.ts: replaces createRequire + package.json read with a constant.
 * - src/cli.ts: strips the source shebang (banner provides it).
 * - src/generators/typescript.ts: inlines policy-runtime.ts content so the
 *   generate command works without the source tree on disk.
 */
const inlineBuildTimeConstants = {
  name: "inline-build-time-constants",
  setup(build) {
    build.onLoad({ filter: /src[\\/]index\.ts$/ }, async (args) => {
      let contents = readFileSync(args.path, "utf8");

      contents = contents.replace(
        /import { createRequire } from "node:module";\n\nconst require = createRequire\(import\.meta\.url\);\nconst pkg = require\("\.\.\/package\.json"\) as \{ version: string \};\n\nexport const VERSION: string = pkg\.version;/,
        `export const VERSION: string = ${JSON.stringify(pkg.version)};`,
      );

      return { contents, loader: "ts" };
    });

    build.onLoad({ filter: /src[\\/]cli\.ts$/ }, async (args) => {
      let contents = readFileSync(args.path, "utf8");
      contents = contents.replace(/^#!.*\n/, "");
      return { contents, loader: "ts" };
    });

    const policyRuntimeContent = readFileSync("src/policy-runtime.ts", "utf8");
    build.onLoad({ filter: /generators[\\/]typescript\.ts$/ }, async (args) => {
      let contents = readFileSync(args.path, "utf8");

      contents = contents.replace(
        /const __filename = fileURLToPath\(import\.meta\.url\);\nconst __dirname = dirname\(__filename\);\n\nfunction loadPolicyRuntime\(\): string \{\n\s*const pkgRoot = resolve\(__dirname, "\.\.", "\.\."\);\n\s*const runtimePath = resolve\(pkgRoot, "src", "policy-runtime\.ts"\);\n\s*return readFileSync\(runtimePath, "utf-8"\);\n\}/,
        `function loadPolicyRuntime(): string {\n  return ${JSON.stringify(policyRuntimeContent)};\n}`,
      );

      return { contents, loader: "ts" };
    });
  },
};

const result = await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: "dist/cli-contracts.bundle.mjs",
  minify,
  sourcemap: true,

  external: externalSdks,

  mainFields: ["module", "main"],
  conditions: ["import", "node"],

  banner: {
    js: [
      "#!/usr/bin/env node",
      "import { createRequire as __banner_createRequire } from 'module';",
      "const require = __banner_createRequire(import.meta.url);",
    ].join("\n"),
  },

  plugins: [resolveRuntimeDynamicImports, inlineBuildTimeConstants],

  logLevel: "info",
});

if (result.errors.length > 0) {
  process.exit(1);
}

const stat = statSync("dist/cli-contracts.bundle.mjs");
const sizeKB = (stat.size / 1024).toFixed(1);
const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
console.log(`\n✓ dist/cli-contracts.bundle.mjs  ${sizeKB} KB (${sizeMB} MB)`);
