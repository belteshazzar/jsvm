import { expect, test } from 'vitest';

import lex from '../../src/lexer.js';
import parse from '../../src/parser.js';
import compile from '../../src/compiler.js';
import createVM from '../../src/vm.js';
import { createDefaultEnv } from '../../src/env.js';

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