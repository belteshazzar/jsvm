import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const COMPILER_BIN = path.resolve(process.cwd(), 'compiler/bin/jsc');
const VM_BIN = path.resolve(process.cwd(), 'vm-js/bin/jsvm');

function runCompiler({ args = [], stdin = null } = {}) {
  return spawnSync(process.execPath, [COMPILER_BIN, ...args], {
    input: stdin ?? undefined,
    encoding: 'utf8',
  });
}

function runVm({ args = [], stdin = null } = {}) {
  return spawnSync(process.execPath, [VM_BIN, ...args], {
    input: stdin ?? undefined,
    encoding: 'utf8',
  });
}

describe('split CLIs', () => {
  it('compiles code from stdin and runs the bytecode', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-'));
    const bytecodeFile = path.join(dir, 'prog.bc');

    const compile = runCompiler({ args: ['--out', bytecodeFile], stdin: 'print(1+2);\n' });
    expect(compile.status).toBe(0);
    expect(compile.stderr).toBe('');

    const run = runVm({ args: ['--file', bytecodeFile] });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout.trim()).toBe('3');
  });

  it('compiles code from --file and runs the bytecode', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-'));
    const sourceFile = path.join(dir, 'prog.js');
    const bytecodeFile = path.join(dir, 'prog.bc');
    await fs.writeFile(sourceFile, 'print(`a${1+2}b`);\n', 'utf8');

    const compile = runCompiler({ args: ['--file', sourceFile, '--out', bytecodeFile] });
    expect(compile.status).toBe(0);
    expect(compile.stderr).toBe('');

    const run = runVm({ args: ['--file', bytecodeFile] });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout.trim()).toBe('a3b');
  });

  it('prints help for both tools', () => {
    const compiler = runCompiler({ args: ['--help'] });
    expect(compiler.status).toBe(0);
    expect(compiler.stdout).toContain('Usage: jsc');

    const vm = runVm({ args: ['--help'] });
    expect(vm.status).toBe(0);
    expect(vm.stdout).toContain('Usage: jsvm');
  });
});
