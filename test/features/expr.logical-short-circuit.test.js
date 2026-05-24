import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';

test('logical short-circuit: side effects only run when needed', () => {
  const src = `
let x = 0;
false && (x = 1);
print(x);
true || (x = 2);
print(x);
true && (x = 3);
print(x);
false || (x = 4);
print(x);
`;

  expect(printed(src)).toEqual(['0', '0', '3', '4']);
});

test('logical short-circuit: avoids evaluating throwing branch', () => {
  const src = `
function boom() { missingName; return 0; }
print(true || boom());
print(false && boom());
`;

  expect(printed(src)).toEqual(['true', 'false']);
});

test('logical operators return operand values', () => {
  const src = `
print(0 && 99);
print(5 && 99);
print(0 || 99);
print(5 || 99);
`;

  expect(printed(src)).toEqual(['0', '99', '99', '5']);
});
