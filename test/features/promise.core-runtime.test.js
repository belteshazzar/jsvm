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
