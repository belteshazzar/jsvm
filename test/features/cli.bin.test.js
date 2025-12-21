import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BIN = path.resolve(process.cwd(), 'bin/jsvm');

function runCli({ args = [], stdin = null } = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    input: stdin ?? undefined,
    encoding: 'utf8',
  });
}

describe('CLI bin/jsvm', () => {
  it('runs code from stdin', () => {
    const res = runCli({ stdin: 'print(1+2);\n' });
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout.trim()).toBe('3');
  });

  it('runs code from --file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-'));
    const file = path.join(dir, 'prog.js');
    await fs.writeFile(file, 'print(`a${1+2}b`);\n', 'utf8');

    const res = runCli({ args: ['--file', file] });
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
    expect(res.stdout.trim()).toBe('a3b');
  });

  it('prints help with --help', () => {
    const res = runCli({ args: ['--help'] });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Usage: jsvm');
  });
});
