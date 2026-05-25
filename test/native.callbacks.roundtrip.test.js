import { describe, test, expect } from 'vitest';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { encodeBundle, decodeBundle } from '../external/jsvm-bytecode-definition/src/index.js';
import { createVM, createDefaultEnv } from '../external/jsvm-vm-js/src/index.js';

const ROOT = path.resolve(process.cwd());
const COMPILER_NODE_MODULES = path.join(ROOT, 'external', 'jsvm-compiler', 'node_modules');
const BYTECODE_MODULE_LINK = path.join(COMPILER_NODE_MODULES, 'jsvm-bytecode-definition');
const BYTECODE_MODULE_TARGET = path.join(ROOT, 'external', 'jsvm-bytecode-definition');

async function ensureCompilerDependencyLink() {
  if (existsSync(BYTECODE_MODULE_LINK)) return;

  await fs.mkdir(COMPILER_NODE_MODULES, { recursive: true });
  await fs.symlink(BYTECODE_MODULE_TARGET, BYTECODE_MODULE_LINK, 'dir');
}

async function compileSource(source) {
  await ensureCompilerDependencyLink();
  const { compileSource: compileViaExternalCompiler } = await import('../external/jsvm-compiler/src/index.js');
  return compileViaExternalCompiler(source);
}

async function compileEncodeDecode(source) {
  const compiled = await compileSource(source);
  const encoded = encodeBundle(compiled);
  return decodeBundle(encoded);
}

describe('coordination: native callback roundtrip examples', () => {
  test('sync native callback receives params and returns number', async () => {
    const bundle = await compileEncodeDecode([
      'let sum = hostAdd(7, 35);',
      'print(sum);',
    ].join('\n'));

    const output = [];
    const env = createDefaultEnv({
      onPrint: s => output.push(String(s)),
    });

    const calls = [];
    env.builtins.hostAdd = {
      type: 'native',
      name: 'hostAdd',
      arity: 2,
      call: (vm, args) => {
        const a = args[0]?.type === 'num' ? args[0].value : 0;
        const b = args[1]?.type === 'num' ? args[1].value : 0;
        calls.push([a, b]);
        return { type: 'num', value: a + b };
      },
    };

    const vm = createVM(bundle, { env });
    vm.runMain();

    expect(calls).toEqual([[7, 35]]);
    expect(output).toEqual(['42']);
  });

  test('async native callback returns promise and resumes await', async () => {
    const bundle = await compileEncodeDecode([
      'async function demo() {',
      '  let doubled = await hostDelayDouble(21);',
      '  print(doubled);',
      '}',
      'demo();',
    ].join('\n'));

    const output = [];
    const env = createDefaultEnv({
      onPrint: s => output.push(String(s)),
    });

    env.builtins.hostDelayDouble = {
      type: 'native',
      name: 'hostDelayDouble',
      arity: 1,
      call: (vm, args) => {
        const n = args[0]?.type === 'num' ? args[0].value : 0;
        const p = vm.createPromise();

        vm.enqueueTimer(() => {
          vm.promiseResolve(p, { type: 'num', value: n * 2 });
        }, 0);

        return p;
      },
    };

    const vm = createVM(bundle, { env });
    vm.runMain();

    expect(output).toEqual(['42']);
  });
});