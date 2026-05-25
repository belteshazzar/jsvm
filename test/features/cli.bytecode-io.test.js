import { test, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const COMPILER_BIN = path.resolve(process.cwd(), 'compiler/bin/jsc');
const VM_BIN = path.resolve(process.cwd(), 'vm-js/bin/jsvm');

function runCompiler(args, stdin = null) {
  return spawnSync(process.execPath, [COMPILER_BIN, ...args], {
    input: stdin ?? undefined,
    encoding: 'utf8',
  });
}

function runVm(args, stdin = null) {
  return spawnSync(process.execPath, [VM_BIN, ...args], {
    input: stdin ?? undefined,
    encoding: 'utf8',
  });
}

test('cli: emit bytecode then run bytecode', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-cli-bc-'));
  const srcPath = path.join(tmpDir, 'prog.js');
  const bcPath = path.join(tmpDir, 'prog.bcb');

  await fs.writeFile(srcPath, "print('hello');\n", 'utf8');

  const emit = runCompiler(['--file', srcPath, '--out', bcPath]);
  expect(emit.status).toBe(0);

  const run = runVm(['--file', bcPath]);
  expect(run.status).toBe(0);
  expect(run.stdout.trim().split(/\n+/)).toEqual(['hello']);
});
