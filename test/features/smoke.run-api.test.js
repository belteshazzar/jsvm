import { expect, test } from 'vitest';
import { run } from '../../main.js';

test('public run() API captures output', () => {
  const output = [];
  const ret = run('print("hi");', { onPrint: s => output.push(s) });
  expect(output).toEqual(['hi']);
  expect(ret).toEqual({ type: 'null' });
});
