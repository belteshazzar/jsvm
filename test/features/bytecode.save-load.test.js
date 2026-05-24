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

test('bytecode: async/await functions preserved through encode/decode', async () => {
  // This test verifies that async functions with await keep their async flag
  // through the bytecode encode/decode cycle. This was a bug where the encoder
  // didn't save the 'async' flag on function objects.
  const src = `
    async function addOneLater(x) {
      await new Promise(r => setTimeout(r, 1));
      return x + 1;
    }
    
    async function main() {
      print("start");
      const result = await addOneLater(41);
      print(result);
    }
    
    main();
  `;

  const expected = printed(src);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jsvm-async-bytecode-'));
  const bundlePath = path.join(tmpDir, 'async.bcb');

  // Encode to bytecode
  const buf = compileBinary(src);
  await fs.writeFile(bundlePath, buf);

  // Load and run the bytecode
  const loadedBuf = await fs.readFile(bundlePath);
  const out = [];
  await runBundleBuffer(loadedBuf, { onPrint: s => out.push(s) });

  expect(out).toEqual(expected);
});
