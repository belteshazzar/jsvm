import { test, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { compileBinary, runBundleBuffer } from '../../main.js';
import { printed } from '../helpers/run.js';

test('bytecode: compile->save->load->run produces same output', async () => {
  const src = `
    let x = 2;
    switch (x) {
      case 1: print('one'); break;
      case 2: print('two'); break;
      default: print('other');
    }
  `;

  const expected = printed(src);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-bytecode-'));
  const bundlePath = path.join(tmpDir, 'prog.bcb');

  const buf = compileBinary(src);
  await fs.writeFile(bundlePath, buf);

  const loadedBuf = await fs.readFile(bundlePath);
  const out = [];
  runBundleBuffer(loadedBuf, { onPrint: s => out.push(s) });

  expect(out).toEqual(expected);
});

test('bytecode: version mismatch bundle errors', () => {
  // Not a valid JSVB bundle buffer.
  const bad = Buffer.from('nope');
  expect(() => runBundleBuffer(bad, { onPrint: () => {} })).toThrow();
});
