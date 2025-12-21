import { describe, it, expect } from 'vitest';
import { printed } from '../helpers/run.js';

describe('for loops', () => {
  it('classic for loop sums numbers', () => {
    const out = printed(`
      let s = 0;
      for (let i = 1; i <= 5; i = i + 1) {
        s = s + i;
      }
      print(s);
    `);
    expect(out).toEqual(['15']);
  });

  it('classic for loop allows empty parts', () => {
    const out = printed(`
      let i = 0;
      let s = 0;
      for (; i < 3; ) {
        s = s + 10;
        i = i + 1;
      }
      print(s);
    `);
    expect(out).toEqual(['30']);
  });

  it('for..of over arrays (limited)', () => {
    const out = printed(`
      let s = 0;
      for (let x of [1, 2, 3]) {
        s = s + x;
      }
      print(s);
    `);
    expect(out).toEqual(['6']);
  });

  it('for..in over objects (limited)', () => {
    const out = printed(`
      let o = { a: 1, b: 2 };
      let s = '';
      for (let k in o) {
        s = s + k;
      }
      // JS doesn't guarantee order, but our keys() uses Object.keys insertion order.
      print(s);
    `);
    expect(out).toEqual(['ab']);
  });
});
