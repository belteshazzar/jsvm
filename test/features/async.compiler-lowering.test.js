import { test, expect } from 'vitest';

import lex from '../../src/core/lexer.js';
import parse from '../../src/core/parser.js';
import compile from '../../src/core/compiler.js';

function compileSource(src) {
  return compile(parse(lex(src)));
}

test('compiler: async function metadata is emitted on function table', () => {
  const bc = compileSource('async function f(x) { return x; } f(1);');
  const fn = bc.functions.find(f => f.name === 'f');
  expect(fn).toBeTruthy();
  expect(fn.async).toBe(true);
});

test('compiler: await lowers to AWAIT opcode and records await site', () => {
  const bc = compileSource('async function f(x) { return await x; } f(1);');
  const fn = bc.functions.find(f => f.name === 'f');
  expect(fn).toBeTruthy();
  const awaitIndex = fn.code.findIndex(i => i.op === 'AWAIT');
  expect(awaitIndex).toBeGreaterThanOrEqual(0);
  expect(fn.awaitSites).toContain(awaitIndex);
});

test('compiler: async function expression metadata and await lowering', () => {
  const bc = compileSource('let f = async function(x) { return await x; }; f(1);');
  const fn = bc.functions.find(f => f.name === '<anonymous>');
  expect(fn).toBeTruthy();
  expect(fn.async).toBe(true);
  expect(fn.code.some(i => i.op === 'AWAIT')).toBe(true);
});

test('compiler: await outside async function is rejected', () => {
  expect(() => compileSource('let x = await 1;')).toThrow(/await.*async functions/i);
});
