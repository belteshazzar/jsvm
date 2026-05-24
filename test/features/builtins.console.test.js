import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';

test('console exists and is object-like', () => {
  expect(printed('print(typeof console);')).toEqual(['obj']);
});

test('console.log is variadic and space-joins values', () => {
  const src = `
console.log('a', 1, true, null, undefined);
`;
  expect(printed(src)).toEqual(['a 1 true null undefined']);
});

test('console.info/warn/error print through runtime output', () => {
  const src = `
console.info('i', 1);
console.warn('w', 2);
console.error('e', 3);
`;
  expect(printed(src)).toEqual(['i 1', 'w 2', 'e 3']);
});

test('console methods return undefined-like value', () => {
  const src = `
print(typeof console.log('x'));
print(typeof console.error('y'));
`;
  // The console methods also print their own messages first.
  expect(printed(src)).toEqual(['x', 'undef', 'y', 'undef']);
});
