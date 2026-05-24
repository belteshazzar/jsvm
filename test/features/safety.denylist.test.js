import { test, expect } from 'vitest';
import { run } from '../../main.js';

test('denylist: eval is not available', () => {
  expect(() => run('eval("1+1");')).toThrow(/Undefined variable 'eval'/);
});

test('denylist: Function constructor is not available', () => {
  expect(() => run('Function("return 1");')).toThrow(/Undefined variable 'Function'/);
});

test('denylist: globalThis is not available', () => {
  expect(() => run('globalThis;')).toThrow(/Undefined variable 'globalThis'/);
});

test('denylist: process is not available to user code', () => {
  expect(() => run('process;')).toThrow(/Undefined variable 'process'/);
});
