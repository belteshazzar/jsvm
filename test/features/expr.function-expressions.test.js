import { describe, it, expect } from 'vitest';
import { runAndCapture } from '../helpers/run.js';

describe('function expressions', () => {
  it('anonymous function expression assigned to variable', () => {
    const out = [];
    runAndCapture(`
      let f = function(x) { return x + 1; };
      print(f(2));
    `, { onPrint: s => out.push(s) });
    expect(out).toEqual(['3']);
  });

  it('IIFE works', () => {
    const out = [];
    runAndCapture(`
      print((function(x){ return x * 2; })(21));
    `, { onPrint: s => out.push(s) });
    expect(out).toEqual(['42']);
  });

  it('function expressions can close over variables', () => {
    const out = [];
    runAndCapture(`
      let x = 10;
      let f = function(y) { return x + y; };
      x = 32;
      print(f(8));
    `, { onPrint: s => out.push(s) });
    expect(out).toEqual(['40']);
  });

  it('named function expression name is scoped to function body (supports recursion)', () => {
    const out = [];
    runAndCapture(`
      let fact = function f(n) {
        if (n == 0) return 1;
        return n * f(n - 1);
      };
      print(fact(5));
    `, { onPrint: s => out.push(s) });
    expect(out).toEqual(['120']);
  });
});
