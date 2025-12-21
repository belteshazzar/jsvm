import { describe, it, expect } from 'vitest';
import { runAndCapture } from '../helpers/run.js';

describe('Error locations', () => {
  it('includes line:col for undefined variable', () => {
    try {
      runAndCapture('print(Notfound.random()+2);');
      expect.fail('Expected VMError');
    } catch (e) {
      expect(String(e)).toContain("Undefined variable 'Notfound'");
      expect(String(e)).toMatch(/\(at 1:\d+\)/);
    }
  });
});
