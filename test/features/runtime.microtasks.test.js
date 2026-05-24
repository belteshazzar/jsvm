import { expect, test } from 'vitest';

import lex from '../../src/core/lexer.js';
import parse from '../../src/core/parser.js';
import compile from '../../src/core/compiler.js';
import createVM from '../../src/core/vm.js';
import { createDefaultEnv } from '../../src/core/env.js';

function makeVM(src, out = [], options = {}) {
  const bc = compile(parse(lex(src)));
  const env = createDefaultEnv({ onPrint: s => out.push(s) });
  return createVM(bc, { env, ...options });
}

test('microtasks drain after synchronous runMain execution', () => {
  const out = [];
  const vm = makeVM('print("sync");', out);

  vm.enqueueMicrotask(() => out.push('m1'));
  vm.enqueueMicrotask(() => out.push('m2'));

  vm.runMain();
  expect(out).toEqual(['sync', 'm1', 'm2']);
});

test('microtasks are FIFO and nested microtasks drain in same checkpoint', () => {
  const out = [];
  const vm = makeVM('print("start");', out);

  vm.enqueueMicrotask(() => {
    out.push('a');
    vm.enqueueMicrotask(() => out.push('c'));
  });
  vm.enqueueMicrotask(() => out.push('b'));

  vm.runMain();
  expect(out).toEqual(['start', 'a', 'b', 'c']);
});

test('runMicrotasks can be called directly', () => {
  const out = [];
  const vm = makeVM('null;', out);

  vm.enqueueMicrotask(() => out.push('x'));
  vm.enqueueMicrotask(() => out.push('y'));

  const ran = vm.runMicrotasks();
  expect(ran).toBe(2);
  expect(out).toEqual(['x', 'y']);
});

test('enqueueMicrotask requires a function', () => {
  const vm = makeVM('null;');
  expect(() => vm.enqueueMicrotask(123)).toThrow(/Microtask must be a function/);
});

test('microtask queue limit prevents runaway recursion', () => {
  const vm = makeVM('null;', [], { microtaskLimit: 2 });

  vm.enqueueMicrotask(() => {
    vm.enqueueMicrotask(() => {
      vm.enqueueMicrotask(() => {});
    });
  });

  expect(() => vm.runMicrotasks()).toThrow(/Microtask queue limit exceeded/);
});
