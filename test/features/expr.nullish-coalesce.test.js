import { test, expect } from 'vitest';
import { run } from '../../main.js';

test('nullish coalescing basic', () => {
  expect(run('(null ?? 42);')).toEqual({ type: 'num', value: 42 });
  expect(run('(undefined ?? 7);')).toEqual({ type: 'num', value: 7 });
  expect(run('(0 ?? 1);')).toEqual({ type: 'num', value: 0 });
  expect(run('(false ?? 1);')).toEqual({ type: 'bool', value: false });
  expect(run('("" ?? "x");')).toEqual({ type: 'str', value: '' });
});

test('nullish coalescing with expressions', () => {
  expect(run('let x = null; (x ?? 5);')).toEqual({ type: 'num', value: 5 });
  expect(run('let x = 0; (x ?? 5);')).toEqual({ type: 'num', value: 0 });
});

test('nullish coalescing is left-associative', () => {
  expect(run('(null ?? undefined ?? 3);')).toEqual({ type: 'num', value: 3 });
  expect(run('(null ?? 2 ?? 3);')).toEqual({ type: 'num', value: 2 });
});

test('nullish coalescing precedence', () => {
  expect(run('1 + (null ?? 2);')).toEqual({ type: 'num', value: 3 });
  expect(run('(null ?? 2) + 1;')).toEqual({ type: 'num', value: 3 });
  expect(run('((0 ?? 1) || 2);')).toEqual({ type: 'num', value: 2 });
});
