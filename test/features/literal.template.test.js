import { describe, it, expect } from 'vitest';
import { runAndCapture } from '../helpers/run.js';

describe('Template literals', () => {
  it('supports no-substitution templates', () => {
    const { output } = runAndCapture('print(`hello`);');
    expect(output).toEqual(['hello']);
  });

  it('supports interpolation with expression evaluation', () => {
    const { output } = runAndCapture('print(`a${1+2}b`);');
    expect(output).toEqual(['a3b']);
  });

  it('evaluates interpolations left-to-right', () => {
    const src = "let x = 0; function bump() { x = x + 1; return x; } print(`a${bump()}b${bump()}c`);";
    const { output } = runAndCapture(src);
    expect(output).toEqual(['a1b2c']);
  });

  it('allows empty chunks around interpolations', () => {
    const { output } = runAndCapture('print(`${1}${2}`);');
    expect(output).toEqual(['12']);
  });

  it('supports simple escapes for backtick and dollar', () => {
    const { output } = runAndCapture('print(`\\`\\${\\$}`);');
    expect(output).toEqual(['`${$}']);
  });
});
