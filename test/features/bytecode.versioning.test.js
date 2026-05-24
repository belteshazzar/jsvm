import { expect, test } from 'vitest';

import lex from '../../src/core/lexer.js';
import parse from '../../src/core/parser.js';
import compile from '../../src/core/compiler.js';
import createVM from '../../src/core/vm.js';

test('compiler emits bytecodeVersion 1', () => {
  const bc = compile(parse(lex('print("x");')));
  expect(bc.bytecodeVersion).toBe(1);
});

test('vm rejects unsupported bytecodeVersion', () => {
  const bc = compile(parse(lex('print("x");')));
  const bad = { ...bc, bytecodeVersion: 999 };
  expect(() => createVM(bad)).toThrow(/Unsupported bytecodeVersion/);
});
