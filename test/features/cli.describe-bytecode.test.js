import { test, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BIN = path.resolve(process.cwd(), 'compiler/bin/jsc');

function runCli(args, stdin = null) {
  return spawnSync(process.execPath, [BIN, ...args], {
    input: stdin ?? undefined,
    encoding: 'utf8',
  });
}

test('cli: describe bytecode prints imports and exports metadata', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-cli-describe-'));
  const srcPath = path.join(tmpDir, 'prog.js');
  const bcPath = path.join(tmpDir, 'prog.bcb');

  const src = `
    import { x as y } from './dep.js';
    export { y as namedY };
    export default 42;
    export { z as namedZ } from './other.js';
  `;
  await fs.writeFile(srcPath, src, 'utf8');

  const emit = runCli(['--file', srcPath, '--out', bcPath]);
  expect(emit.status).toBe(0);

  const desc = runCli(['--describe-bytecode', bcPath]);
  expect(desc.status).toBe(0);
  expect(desc.stdout).toContain('Bytecode Metadata');
  expect(desc.stdout).toContain('Imports:');
  expect(desc.stdout).toContain("./dep.js: x as y");
  expect(desc.stdout).toContain('Exports:');
  expect(desc.stdout).toContain('y as namedY');
  expect(desc.stdout).toContain('default');
  expect(desc.stdout).toContain("from ./other.js: z as namedZ");
});

test('cli: describe-bytecode cannot be combined with --file', () => {
  const res = runCli(['--describe-bytecode', './x.bcb', '--file', './prog.js']);
  expect(res.status).toBe(2);
  expect(res.stderr).toContain('Cannot combine --describe-bytecode');
});
