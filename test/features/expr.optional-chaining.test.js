import { test, expect } from 'vitest';
import { run } from '../../main.js';

test('optional chaining: property', () => {
  expect(run('let o = {a: 1}; o?.a;')).toEqual({ type: 'num', value: 1 });
  expect(run('let o = null; o?.a;')).toEqual({ type: 'undef' });
  expect(run('let o = undefined; o?.a;')).toEqual({ type: 'undef' });
});

test('optional chaining: element', () => {
  expect(run('let a = [10]; a?.[0];')).toEqual({ type: 'num', value: 10 });
  expect(run('let a = null; a?.[0];')).toEqual({ type: 'undef' });
  expect(run('let a = undefined; a?.[0];')).toEqual({ type: 'undef' });
});

test('optional chaining: call', () => {
  expect(run('function f(x) { return x+1; } f?.(2);')).toEqual({ type: 'num', value: 3 });
  expect(run('let f = null; f?.(2);')).toEqual({ type: 'undef' });
  expect(run('let f = undefined; f?.(2);')).toEqual({ type: 'undef' });
});

test('optional chaining: nested', () => {
  expect(run('let o = null; o?.a?.b;')).toEqual({ type: 'undef' });
  expect(run('let o = {a: null}; o?.a?.b;')).toEqual({ type: 'undef' });
  expect(run('let o = {a: {b: 5}}; o?.a?.b;')).toEqual({ type: 'num', value: 5 });
});
