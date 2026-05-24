import { test, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { compileBinary, runBundleBuffer } from '../../main.js';
import { decodeBundle } from '../../src/bytecode/io.js';
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
      await Promise.resolve();
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

test('bytecode: module metadata preserved through encode/decode', () => {
  const src = `
    import { x as y } from './dep.js';
    export { y as namedY };
    export default 42;
    export { z as namedZ } from './other.js';
  `;

  const decoded = decodeBundle(compileBinary(src));

  expect(decoded.imports).toEqual([
    {
      source: './dep.js',
      specifiers: [{ imported: 'x', local: 'y' }],
    },
  ]);
  expect(decoded.exports).toEqual([{ exported: 'namedY', local: 'y' }]);
  expect(decoded.defaultExport).toMatchObject({ type: 'Literal', value: 42 });
  expect(decoded.reExports).toEqual([
    {
      source: './other.js',
      specifiers: [{ local: 'z', exported: 'namedZ' }],
    },
  ]);
});

test('bytecode: import instructions run correctly after binary roundtrip', async () => {
  const src = `
    import { foo as localFoo } from './dep.js';
    print(localFoo);
  `;

  const out = [];
  runBundleBuffer(compileBinary(src), {
    onPrint: s => out.push(s),
    requestImport: (modulePath) => {
      if (modulePath === './dep.js') return { foo: 123 };
      throw new Error('Unexpected module path');
    },
  });

  expect(out).toEqual(['123']);
});
