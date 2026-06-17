#!/usr/bin/env node
// PostToolUse hook: formats the touched file with Prettier and lints it with ESLint.
// Triggered after Write / Edit / MultiEdit (see .claude/settings.json).
// Reads the hook event JSON from stdin, extracts tool_input.file_path, and runs:
//   1. prettier --ignore-unknown --write <file>   (any file type Prettier understands)
//   2. eslint --fix <file>                        (only JS/TS family files)
// Always exits 0 so it never blocks Claude's flow; problems go to stderr.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';

const LINTABLE = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const isWindows = process.platform === 'win32';

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: isWindows, // resolve npx.cmd on Windows
  });
  return result;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;

  let filePath;
  try {
    filePath = JSON.parse(raw)?.tool_input?.file_path;
  } catch {
    return; // malformed payload -> no-op
  }

  if (!filePath || !existsSync(filePath)) return; // nothing to format

  // 1. Prettier on anything it recognizes; --ignore-unknown skips unsupported types.
  const prettier = run('npx', ['prettier', '--ignore-unknown', '--write', filePath]);
  if (prettier.status !== 0 && prettier.stderr) {
    process.stderr.write(`[format-and-lint] prettier: ${prettier.stderr.trim()}\n`);
  }

  // 2. ESLint --fix only on JS/TS family files.
  if (LINTABLE.has(extname(filePath).toLowerCase())) {
    const eslint = run('npx', ['eslint', '--fix', filePath]);
    if (eslint.status !== 0 && (eslint.stdout || eslint.stderr)) {
      process.stderr.write(
        `[format-and-lint] eslint: ${(eslint.stdout || eslint.stderr).trim()}\n`,
      );
    }
  }
}

main()
  .catch((err) => {
    process.stderr.write(`[format-and-lint] ${err?.message ?? err}\n`);
  })
  .finally(() => process.exit(0));
