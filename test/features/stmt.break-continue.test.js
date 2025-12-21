import { expect, test } from 'vitest';
import { runAndCapture } from '../helpers/run.js';

test('break exits the nearest loop', () => {
  const out = [];
  runAndCapture(`
    let x = 0;
    while (true) {
      x = x + 1;
      if (x == 3) break;
    }
    print(x);
  `, { onPrint: s => out.push(s) });
  expect(out).toEqual(['3']);
});

test('continue jumps to next iteration', () => {
  const out = [];
  runAndCapture(`
    let sum = 0;
    for (let i = 0; i < 5; i = i + 1) {
      if (i == 2) continue;
      sum = sum + i;
    }
    print(sum);
  `, { onPrint: s => out.push(s) });
  expect(out).toEqual(['8']);
});

test('break/continue work with for..of iterator path (object)', () => {
  const out = [];
  runAndCapture(`
    const o = { a: 1, b: 2, c: 3 };
    let seen = 0;
    for (let k of o) {
      if (k == 'b') continue;
      seen = seen + 1;
      if (k == 'c') break;
    }
    print(seen);
  `, { onPrint: s => out.push(s) });
  expect(out).toEqual(['2']);
});
