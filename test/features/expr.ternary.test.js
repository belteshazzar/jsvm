import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('ternary selects correct branch', () => {
  const src = `
print(true ? 1 : 2);
print(false ? 1 : 2);
`;
  expect(printed(src)).toEqual(['1', '2']);
});

test('ternary is lazy (only chosen branch evaluates)', () => {
  const src = `
function boom() { unknownVar; return 0; }
print(true ? 123 : boom());
`;
  // If the false branch were evaluated, this would throw.
  expect(printed(src)).toEqual(['123']);
});

test('ternary precedence: || binds tighter than ?:, ?: binds tighter than =', () => {
  const src = `
let a = false;
let b = true;
print(a || b ? 1 : 2);

let x = 0;
x = false ? 1 : 2;
print(x);
`;
  expect(printed(src)).toEqual(['1', '2']);
});

test('ternary nesting (right associative)', () => {
  const src = `
print(false ? 0 : true ? 1 : 2);
print(false ? 0 : false ? 1 : 2);
`;
  expect(printed(src)).toEqual(['1', '2']);
});
