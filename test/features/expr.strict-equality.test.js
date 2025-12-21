import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('strict equality: primitives', () => {
  const src = `
print(1 === 1);
print(1 !== 1);
print("a" === "a");
print(true !== false);
`;
  expect(printed(src)).toEqual(['true', 'false', 'true', 'true']);
});

test('strict equality: null vs undefined', () => {
  const src = `
print(null === undefined);
print(null !== undefined);
print(undefined === undefined);
`;
  expect(printed(src)).toEqual(['false', 'true', 'true']);
});

test('strict equality: reference identity for objects/arrays', () => {
  const src = `
let a = {x: 1};
let b = {x: 1};
print(a === a);
print(a === b);

let r = [1];
let s = [1];
print(r !== s);
`;
  expect(printed(src)).toEqual(['true', 'false', 'true']);
});
