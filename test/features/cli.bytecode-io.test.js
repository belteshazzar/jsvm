import { test, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BIN = path.resolve(process.cwd(), 'bin/jsvm');

function runCli(args, stdin = null) {
  const res = spawnSync(process.execPath, [BIN, ...args], {
    input: stdin ?? undefined,
    encoding: 'utf8',
  });
  return res;
}

test('cli: emit bytecode then run bytecode', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-cli-bc-'));
  const srcPath = path.join(tmpDir, 'prog.js');
  const bcPath = path.join(tmpDir, 'prog.bc.json');

  await fs.writeFile(srcPath, "print('hello');\n", 'utf8');

  const emit = runCli(['--file', srcPath, '--emit-bytecode', bcPath]);
  expect(emit.status).toBe(0);

  const run = runCli(['--run-bytecode', bcPath]);
  expect(run.status).toBe(0);
  expect(run.stdout.trim().split(/\n+/)).toEqual(['hello']);
});
