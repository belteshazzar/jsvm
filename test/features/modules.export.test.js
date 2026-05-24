import { test, expect } from 'vitest';
import { compile } from '../../main.js';
import createVM from '../../src/core/vm.js';
import { createDefaultEnv } from '../../src/core/env.js';

test('module with named exports', () => {
  const src = `
    const x = 42;
    const y = 'hello';
    export { x, y };
  `;
  
  const bundle = compile(src);
  expect(bundle.exports).toEqual([
    { exported: 'x', local: 'x' },
    { exported: 'y', local: 'y' }
  ]);
});

test('module with renamed exports', () => {
  const src = `
    const value = 10;
    export { value as exported };
  `;
  
  const bundle = compile(src);
  expect(bundle.exports).toEqual([
    { exported: 'exported', local: 'value' }
  ]);
});

test('multiple exports from single statement', () => {
  const src = `
    const a = 1;
    const b = 2;
    const c = 3;
    export { a, b as renamed_b, c };
  `;
  
  const bundle = compile(src);
  expect(bundle.exports).toEqual([
    { exported: 'a', local: 'a' },
    { exported: 'renamed_b', local: 'b' },
    { exported: 'c', local: 'c' }
  ]);
});

test('getExports retrieves exported values from VM', () => {
  const src = `
    const x = 42;
    const y = 'hello';
    export { x, y };
  `;
  
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports).toBeTruthy();
  expect(exports.type).toBe('obj');
  expect(exports.map.x).toEqual({ type: 'num', value: 42 });
  expect(exports.map.y).toEqual({ type: 'str', value: 'hello' });
});

test('module with no exports returns null', () => {
  const src = `
    const x = 42;
  `;
  
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports).toBeNull();
});

test('exported functions are callable from imports', () => {
  const src = `
    const greet = (name) => 'Hello, ' + name;
    export { greet };
  `;
  
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.greet.type).toBe('func');
});

test('complex exports with mixed types', () => {
  const src = `
    const num = 42;
    const str = 'world';
    const bool = true;
    const obj = { key: 'value' };
    const arr = [1, 2, 3];
    export { num, str, bool, obj, arr };
  `;
  
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.num).toEqual({ type: 'num', value: 42 });
  expect(exports.map.str).toEqual({ type: 'str', value: 'world' });
  expect(exports.map.bool).toEqual({ type: 'bool', value: true });
  expect(exports.map.obj.type).toBe('obj');
  expect(exports.map.arr.type).toBe('arr');
});
