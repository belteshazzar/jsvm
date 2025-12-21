import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('Block scoping: shadowing inside {} does not leak', () => {
  const src = `
let x = 1;
{
  let x = 2;
  print(x);
}
print(x);
`;
  expect(printed(src)).toEqual(['2', '1']);
});

test('Block scoping: inner binding not visible outside', () => {
  const src = `
{
  let y = 9;
  print(y);
}
print(y);
`;
  // Should throw at runtime when accessing undefined variable.
  expect(() => printed(src)).toThrow(/Undefined variable 'y'/);
});
