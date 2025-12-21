import { describe, it, expect } from 'vitest';
import { runAndCapture } from '../helpers/run.js';

describe('arrow functions', () => {
  it('single param expression body', () => {
    const out = [];
    runAndCapture(`
      let f = x => x + 1;
      print(f(2));
    `, { onPrint: s => out.push(s) });
    expect(out).toEqual(['3']);
  });

  it('parenthesized params and block body', () => {
    const out = [];
    runAndCapture(`
      let add = (a, b) => { return a + b; };
      print(add(20, 22));
    `, { onPrint: s => out.push(s) });
    expect(out).toEqual(['42']);
  });

  it('captures lexical this (not rebound by property call)', () => {
    const out = [];
    runAndCapture(`
      let obj = {
        x: 7,
        get: function() {
          let f = () => this.x;
          let other = { x: 99, call: f };
          return other.call();
        }
      };
      print(obj.get());
    `, { onPrint: s => out.push(s) });
    expect(out).toEqual(['7']);
  });
});
