import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';

test('Promise.resolve schedules then callback as microtask', () => {
  const src = `
print('sync-1');
Promise.resolve(42).then(print);
print('sync-2');
`;
  expect(printed(src)).toEqual(['sync-1', 'sync-2', '42']);
});

test('Promise.reject schedules catch callback as microtask', () => {
  const src = `
print('before');
Promise.reject('boom').catch(print);
print('after');
`;
  expect(printed(src)).toEqual(['before', 'after', 'boom']);
});

test('then without callbacks propagates fulfillment value', () => {
  const src = `
Promise.resolve('ok').then().then(print);
`;
  expect(printed(src)).toEqual(['ok']);
});

test('catch without callback propagates rejection to next catch', () => {
  const src = `
Promise.reject('err').catch().catch(print);
`;
  expect(printed(src)).toEqual(['err']);
});

test('multiple then callbacks preserve registration order', () => {
  const src = `
let p = Promise.resolve('v');
p.then(print);
p.then(print);
`;
  expect(printed(src)).toEqual(['v', 'v']);
});

test('Promise.resolve(promise) returns same promise identity', () => {
  const src = `
let p = Promise.resolve(1);
let q = Promise.resolve(p);
print(p === q);
`;
  expect(printed(src)).toEqual(['true']);
});

test('then callback returning value resolves next promise', () => {
  const src = `
Promise.resolve('x').then(print).then(print);
`;
  // first print gets 'x'; print returns null, so chained promise fulfills with null
  expect(printed(src)).toEqual(['x', 'null']);
});

test('then supports language function callback', () => {
  const src = `
function plus1(x) { return x + 1; }
Promise.resolve(41).then(plus1).then(print);
`;
  expect(printed(src)).toEqual(['42']);
});

test('then supports arrow callback and preserves chain ordering', () => {
  const src = `
Promise.resolve(5)
  .then(x => x * 2)
  .then(x => x + 3)
  .then(print);
`;
  expect(printed(src)).toEqual(['13']);
});

test('catch supports language function callback', () => {
  const src = `
function recover(e) { return 'recovered:' + e; }
Promise.reject('oops').catch(recover).then(print);
`;
  expect(printed(src)).toEqual(['recovered:oops']);
});

test('finally runs on fulfilled promise and preserves value', () => {
  const src = `
Promise.resolve(5)
  .finally(() => print('cleanup'))
  .then(print);
`;
  expect(printed(src)).toEqual(['cleanup', '5']);
});

test('finally runs on rejected promise and preserves reason', () => {
  const src = `
Promise.reject('bad')
  .finally(() => print('cleanup'))
  .catch(print);
`;
  expect(printed(src)).toEqual(['cleanup', 'bad']);
});

test('finally callback rejection overrides prior fulfillment', () => {
  const src = `
Promise.resolve('ok')
  .finally(() => Promise.reject('ferr'))
  .then(print)
  .catch(print);
`;
  expect(printed(src)).toEqual(['ferr']);
});

test('finally callback rejection overrides prior rejection reason', () => {
  const src = `
Promise.reject('orig')
  .finally(() => Promise.reject('ferr'))
  .catch(print);
`;
  expect(printed(src)).toEqual(['ferr']);
});

test('Promise constructor accepts language function executor', () => {
  const src = `
function exec(resolve, reject) { resolve(21); }
Promise(exec).then(print);
`;
  expect(printed(src)).toEqual(['21']);
});

test('Promise constructor rejects non-callable executors with a clear reason', () => {
  const src = `
Promise(1).catch(print);
`;
  expect(printed(src)).toEqual(['TypeError: Promise executor must be callable']);
});

test('Promise constructor converts thrown executor errors into rejection reasons', () => {
  const src = `
function boom(resolve, reject) { missingName; }
Promise(boom).catch(print);
`;
  expect(printed(src)).toEqual([
    "TypeError: Promise executor threw: Undefined variable 'missingName' (at 2:45)",
  ]);
});
