import { expect, test } from 'vitest';

import lex from '../../src/lexer.js';
import parse from '../../src/parser.js';
import compile from '../../src/compiler.js';
import createVM from '../../src/vm.js';

test('compiler emits bytecodeVersion 1', () => {
  const bc = compile(parse(lex('print("x");')));
  expect(bc.bytecodeVersion).toBe(1);
});

test('vm rejects unsupported bytecodeVersion', () => {
  const bc = compile(parse(lex('print("x");')));
  const bad = { ...bc, bytecodeVersion: 999 };
  expect(() => createVM(bad)).toThrow(/Unsupported bytecodeVersion/);
});
