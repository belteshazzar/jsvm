import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('const requires initializer', () => {
  expect(() => printed('const x;')).toThrow(/Expected '=' after const name|Expected '='/);
});

test('const cannot be reassigned', () => {
  const src = `
const x = 1;
x = 2;
`;
  expect(() => printed(src)).toThrow(/Assignment to constant variable 'x'/);
});

test('const can be shadowed in inner block', () => {
  const src = `
const x = 1;
{
  const x = 2;
  print(x);
}
print(x);
`;
  expect(printed(src)).toEqual(['2', '1']);
});
