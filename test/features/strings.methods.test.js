import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';

test('String methods: toUpperCase/toLowerCase/charAt/slice/indexOf/includes', () => {
  const src = `
print('AbC'.toUpperCase());
print('AbC'.toLowerCase());
print('AbC'.charAt(1));
print('abcdef'.slice(1, 4));
print('abcdef'.slice(-3));
print('banana'.indexOf('na'));
print('banana'.indexOf('na', 3));
print('banana'.includes('nan'));
print('banana'.includes('xyz'));
`;

  expect(printed(src)).toEqual([
    'ABC',
    'abc',
    'b',
    'bcd',
    'def',
    '2',
    '4',
    'true',
    'false',
  ]);
});