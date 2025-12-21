import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('Object + array literals and property access', () => {
  const src = `
let o = {a: 1, "b": 2};
print(o.a);
print(o["b"]);
let a = [10, 20];
print(a[0]);
a[1] = 99;
print(a);
`;

  expect(printed(src)).toEqual(['1', '2', '10', '[10, 99]']);
});
