import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';
import { run } from '../../main.js';

test('for loop: init/cond/post and break', () => {
  const src = `
for (let i = 0; i < 6; i = i + 1) {
  if (i == 3) break;
  print(i);
}
`;
  expect(printed(src)).toEqual(['0', '1', '2']);
});

test('for loop: continue skips current iteration', () => {
  const src = `
for (let i = 0; i < 6; i = i + 1) {
  if (i % 2 == 0) continue;
  print(i);
}
`;
  expect(printed(src)).toEqual(['1', '3', '5']);
});

test('for loop: omitted init/cond/post works', () => {
  const src = `
let i = 0;
for (;;) {
  print(i);
  i = i + 1;
  if (i == 3) break;
}
`;
  expect(printed(src)).toEqual(['0', '1', '2']);
});

test('for..of iterates array values', () => {
  const src = `
let sum = 0;
for (let v of [2, 4, 6]) {
  sum = sum + v;
}
print(sum);
`;
  expect(printed(src)).toEqual(['12']);
});

test('for..of iterates string characters', () => {
  const src = `
for (let ch of "ab") {
  print(ch);
}
`;
  expect(printed(src)).toEqual(['a', 'b']);
});

test('for..in iterates object keys', () => {
  const src = `
let o = {a: 1, b: 2};
for (let k in o) {
  print(k);
}
`;
  expect(printed(src)).toEqual(['a', 'b']);
});

test('for..in iterates array index keys', () => {
  const src = `
for (let k in [9, 8, 7]) {
  print(k);
}
`;
  expect(printed(src)).toEqual(['0', '1', '2']);
});

test('continue outside loop throws', () => {
  expect(() => run('continue;')).toThrow(/continue.*within loop/i);
});

test('break outside loop/switch throws', () => {
  expect(() => run('break;')).toThrow(/break.*within loop or switch/i);
});

test('continue in switch without loop throws', () => {
  const src = `
switch (1) {
  case 1:
    continue;
}
`;
  expect(() => run(src)).toThrow(/continue.*within loop/i);
});
