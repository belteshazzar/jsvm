import { test, expect } from 'vitest';

import lex from '../../src/lexer.js';
import parse from '../../src/parser.js';
import compile from '../../src/compiler.js';
import createVM from '../../src/vm.js';
import { createDefaultEnv } from '../../src/env.js';
import { runAndCapture, printed } from '../helpers/run.js';

function runWithBuiltins(src, builtinsExt = {}) {
  const out = [];
  const bc = compile(parse(lex(src)));
  const env = createDefaultEnv({ onPrint: s => out.push(s) });
  Object.assign(env.builtins, builtinsExt);
  const vm = createVM(bc, { env });
  vm.runMain();
  return out;
}

test('async function returns promise and fulfills', () => {
  const src = `
async function f() { return 7; }
f().then(print);
print('sync');
`;
  expect(printed(src)).toEqual(['sync', '7']);
});

test('await with non-promise value', () => {
  const src = `
async function f() { let x = await 2; return x + 3; }
f().then(print);
print('sync');
`;
  expect(printed(src)).toEqual(['sync', '5']);
});

test('await with fulfilled promise', () => {
  const src = `
async function f() { let x = await Promise.resolve(5); return x * 2; }
f().then(print);
print('sync');
`;
  expect(printed(src)).toEqual(['sync', '10']);
});

test('await continuation on fulfilled promise runs after surrounding sync code', () => {
  const src = `
async function addOneLater(x) {
  print('inside addOneLater');
  let v = await Promise.resolve(x + 1);
  return v;
}

async function demo() {
  print('demo begin');
  let a = await addOneLater(41);
  print('value: ' + a);
}

print('start');
demo().then(() => print('done'));
print('after demo call');
`;
  expect(printed(src)).toEqual([
    'start',
    'demo begin',
    'inside addOneLater',
    'after demo call',
    'value: 42',
    'done',
  ]);
});

test('await with rejected promise rejects async function result', () => {
  const src = `
async function f() { return await Promise.reject('bad'); }
f().catch(print);
print('sync');
`;
  expect(printed(src)).toEqual(['sync', 'bad']);
});

test('pending await suspends and resumes via microtask queue', () => {
  const src = `
async function f() {
  print('a');
  let v = await later();
  print('b');
  return v;
}
print('s');
f().then(print);
print('t');
`;

  const out = runWithBuiltins(src, {
    later: {
      type: 'native',
      name: 'later',
      arity: 0,
      call: (vm) => {
        const p = vm.createPromise();
        vm.enqueueMicrotask(() => vm.promiseResolve(p, { type: 'num', value: 9 }));
        return p;
      },
    },
  });

  expect(out).toEqual(['s', 'a', 't', 'b', '9']);
});

test('runtime error inside async function rejects returned promise', () => {
  const { output } = runAndCapture(`
async function f() { missingName; return 1; }
f().catch(print);
print('sync');
`);

  expect(output[0]).toBe('sync');
  expect(output[1]).toMatch(/Undefined variable 'missingName'/);
});
