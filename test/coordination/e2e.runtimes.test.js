import { describe, test, expect } from 'vitest';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { encodeBundle } from '../../external/jsvm-bytecode-definition/src/index.js';
import { createVM, createDefaultEnv } from '../../external/jsvm-vm-js/src/index.js';

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
  const { compileSource } = await import('../../external/jsvm-compiler/src/index.js');
  return compileSource(source);
}

function runInNodeDirect(sourcePath) {
  const shimmedPath = sourcePath + '.node.js';
  const shim = "globalThis.print = (...args) => console.log(...args);\n";
  return fs.readFile(sourcePath, 'utf8')
    .then(src => fs.writeFile(shimmedPath, shim + src, 'utf8'))
    .then(() => runOrThrow(process.execPath, [shimmedPath]))
    .then(res => normalizeOutputLines(res.stdout));
}

function runInJsRuntime(bundle) {
  const output = [];
  const env = createDefaultEnv({
    onPrint: s => output.push(String(s)),
  });
  const vm = createVM(bundle, { env });
  vm.runMain();
  return output;
}

function runInCRuntime(bundlePath) {
  const res = runOrThrow(C_VM_BIN, [bundlePath], { cwd: C_VM_DIR });
  return normalizeOutputLines(res.stdout);
}

describe('coordination: end-to-end parity across runtimes', () => {
  test('compiles once and matches Node, JS VM, and C VM output', async () => {
    await ensureCRuntimeBuilt();

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-e2e-'));
    const sourcePath = path.join(tmpDir, 'program.js');
    const bundlePath = path.join(tmpDir, 'program.bc');

    const source = [
      'print(1 + 2);',
      'let a = 10;',
      'let b = 4;',
      'print(a - b);',
      'print(a * b);',
      'print(a / b);',
      'print(Math.floor(3.7));',
      'print(Math.pow(2, 8));',
    ].join('\n');

    await fs.writeFile(sourcePath, source, 'utf8');

    const bundle = await compileViaExternalCompiler(source);
    await fs.writeFile(bundlePath, encodeBundle(bundle));

    const nodeOutput = await runInNodeDirect(sourcePath);
    const jsVmOutput = runInJsRuntime(bundle);
    const cVmOutput = runInCRuntime(bundlePath);

    expect(jsVmOutput).toEqual(nodeOutput);
    expect(cVmOutput).toEqual(nodeOutput);
  });
});