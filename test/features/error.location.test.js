import { describe, it, expect } from 'vitest';
import { runAndCapture } from '../helpers/run.js';

describe('Error locations', () => {
  it('includes line:col for undefined variable', () => {
    try {
      runAndCapture('print(Math.random()+2);');
      expect.fail('Expected VMError');
    } catch (e) {
      expect(String(e)).toContain("Undefined variable 'Math'");
      expect(String(e)).toMatch(/\(at 1:\d+\)/);
    }
  });
});
