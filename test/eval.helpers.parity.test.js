import { describe, test, expect } from 'vitest';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { encodeBundle } from '../external/jsvm-bytecode-definition/src/index.js';

const ROOT = path.resolve(process.cwd());
const C_VM_DIR = path.join(ROOT, 'external', 'jsvm-c');
const C_VM_BIN = path.join(C_VM_DIR, 'jsvm');
const COMPILER_NODE_MODULES = path.join(ROOT, 'external', 'jsvm-compiler', 'node_modules');
const BYTECODE_MODULE_LINK = path.join(COMPILER_NODE_MODULES, 'jsvm-bytecode-definition');
const BYTECODE_MODULE_TARGET = path.join(ROOT, 'external', 'jsvm-bytecode-definition');

function runOrThrow(command, args, options = {}) {
  const res = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (res.status !== 0) {
    const stderr = (res.stderr ?? '').trim();
    const stdout = (res.stdout ?? '').trim();
    const msg = [
      `Command failed: ${command} ${args.join(' ')}`,
      stderr ? `stderr: ${stderr}` : null,
      stdout ? `stdout: ${stdout}` : null,
    ].filter(Boolean).join('\n');
    throw new Error(msg);
  }
  return res;
}

function normalizeOutputLines(s) {
  return (s ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

async function ensureCRuntimeBuilt() {
  if (existsSync(C_VM_BIN)) return;
  runOrThrow('make', [], { cwd: C_VM_DIR });
}

async function ensureCompilerDependencyLink() {
  if (existsSync(BYTECODE_MODULE_LINK)) return;

  await fs.mkdir(COMPILER_NODE_MODULES, { recursive: true });
  await fs.symlink(BYTECODE_MODULE_TARGET, BYTECODE_MODULE_LINK, 'dir');
}

async function compileViaExternalCompiler(source) {
  await ensureCompilerDependencyLink();
  const { compileSource } = await import('../external/jsvm-compiler/src/index.js');
  return compileSource(source);
}

async function runInNodeDirect(sourcePath) {
  return runOrThrow(process.execPath, [sourcePath]).stdout;
}

function runInCRuntime(bundlePath) {
  const res = runOrThrow(C_VM_BIN, [bundlePath], { cwd: C_VM_DIR });
  return normalizeOutputLines(res.stdout);
}

describe('coordination: eval helper parity across runtimes', () => {
  test('matches strict/directive and mini-eval helper behavior', async () => {
    await ensureCRuntimeBuilt();

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-eval-'));
    const sourcePath = path.join(tmpDir, 'eval-helpers.program.js');
    const bundlePath = path.join(tmpDir, 'eval-helpers.program.bc');

    const source = [
      "let a = 0;",
      "eval(\"var x = 7; a = x;\");",
      "console.log(a);",
      "console.log(eval(\"#!/usr/bin/env node\\n42\"));",
      "console.log(eval(\"9 // trailing comment\"));",
      "let s = 0;",
      "eval(\"// line comment\\ns = -1\");",
      "console.log(s);",
      "try {",
      "  eval(\"'use strict'; arguments = 1;\");",
      "  console.log('NO_THROW');",
      "} catch (e) {",
      "  console.log(e && e.name);",
      "}",
      "try {",
      "  Function(\"'use strict'; var let = 1;\");",
      "  console.log('NO_THROW');",
      "} catch (e) {",
      "  console.log(e && e.name);",
      "}",
    ].join('\n');

    await fs.writeFile(sourcePath, source, 'utf8');

    const bundle = await compileViaExternalCompiler(source);
    await fs.writeFile(bundlePath, encodeBundle(bundle));

    const nodeOutput = normalizeOutputLines(await runInNodeDirect(sourcePath));
    const cVmOutput = runInCRuntime(bundlePath);

    expect(cVmOutput).toEqual(nodeOutput);
  });
});
