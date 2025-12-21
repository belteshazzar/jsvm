import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('undefined literal prints as undefined', () => {
  expect(printed('print(undefined);')).toEqual(['undefined']);
});

test('missing object property yields undefined', () => {
  const src = `
let o = {a: 1};
print(o.b);
print(o["c"]);
`;
  expect(printed(src)).toEqual(['undefined', 'undefined']);
});

test('missing array index yields undefined', () => {
  const src = `
let a = [1];
print(a[1]);
`;
  expect(printed(src)).toEqual(['undefined']);
});

test('array pop/shift on empty yields undefined', () => {
  const src = `
let a = [];
print(a.pop());
print(a.shift());
`;
  expect(printed(src)).toEqual(['undefined', 'undefined']);
});
