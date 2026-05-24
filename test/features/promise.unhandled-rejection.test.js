import { expect, test } from 'vitest';

import lex from '../../src/core/lexer.js';
import parse from '../../src/core/parser.js';
import compile from '../../src/core/compiler.js';
import createVM from '../../src/core/vm.js';
import { createDefaultEnv } from '../../src/core/env.js';

function runWithEvents(src) {
  const events = [];
  const bc = compile(parse(lex(src)));
  const env = createDefaultEnv({
    onPrint: s => events.push(`print:${s}`),
    onUnhandledRejection: message => events.push(`reject:${message}`),
  });
  const vm = createVM(bc, { env });
  vm.runMain();
  return events;
}

test('unhandled rejection is reported after the microtask checkpoint', () => {
  const events = runWithEvents(`
print('start');
Promise.reject('boom');
print('end');
`);

  expect(events).toEqual([
    'print:start',
    'print:end',
    'reject:Unhandled promise rejection: boom',
  ]);
});

test('a catch attached in the same turn suppresses unhandled rejection reporting', () => {
  const events = runWithEvents(`
const p = Promise.reject('boom');
Promise.resolve().then(() => p.catch(() => print('handled')));
`);

  expect(events).toEqual(['print:handled']);
});