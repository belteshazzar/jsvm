import { test, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { compile, runBundle } from '../../main.js';
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
  const bundlePath = path.join(tmpDir, 'prog.bc.json');

  const bundle = compile(src);
  await fs.writeFile(bundlePath, JSON.stringify(bundle), 'utf8');

  const loadedJson = await fs.readFile(bundlePath, 'utf8');
  const out = [];
  runBundle(loadedJson, { onPrint: s => out.push(s) });

  expect(out).toEqual(expected);
});

test('bytecode: version mismatch bundle errors', () => {
  const bad = {
    bytecodeVersion: 999,
    functions: [],
    classes: [],
  };

  expect(() => runBundle(bad, { onPrint: () => {} })).toThrow(/Unsupported bytecodeVersion/);
});
