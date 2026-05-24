import { test, expect } from 'vitest';
import { run } from '../../main.js';

test('negative runtime: assignment to const throws', () => {
  expect(() => run('const x = 1; x = 2;')).toThrow(/Assignment to constant variable 'x'/);
});

test('negative runtime: calling non-function value throws', () => {
  expect(() => run('let x = 1; x();')).toThrow(/Attempt to call a non-function value/);
});

test('negative runtime: calling unknown property as function throws', () => {
  expect(() => run('let o = {}; o.missing();')).toThrow(/Attempt to call non-function property/);
});

test('negative runtime: optional-chain call on non-function still throws', () => {
  expect(() => run('let x = 1; x?.();')).toThrow(/Attempt to call non-function value via optional chain/);
});

test('negative runtime: array sort comparator callback is rejected', () => {
  expect(() => run('[3,1,2].sort(function(a,b){ return a-b; });')).toThrow(/comparator callbacks not supported/);
});
