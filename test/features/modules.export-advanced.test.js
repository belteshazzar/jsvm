import { test, expect } from 'vitest';
import { compile } from '../../main.js';
import createVM from '../../src/core/vm.js';
import { createDefaultEnv } from '../../src/core/env.js';

// ===== Default Exports =====

test('export default literal value', () => {
  const src = `export default 42;`;
  const bundle = compile(src);
  
  expect(bundle.defaultExport).toBeTruthy();
  expect(bundle.defaultExport.type).toBe('Literal');
  expect(bundle.defaultExport.value).toBe(42);
});

test('export default function expression', () => {
  const src = `export default function() { return 'hello'; };`;
  const bundle = compile(src);
  
  expect(bundle.defaultExport).toBeTruthy();
  expect(bundle.defaultExport.type).toBe('FuncExpr');
});

test('export default object literal', () => {
  const src = `export default { x: 1, y: 2 };`;
  const bundle = compile(src);
  
  expect(bundle.defaultExport).toBeTruthy();
  expect(bundle.defaultExport.type).toBe('ObjectLiteral');
});

test('getExports includes default export', () => {
  const src = `export default 42;`;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports).toBeTruthy();
  expect(exports.map.default).toEqual({ type: 'num', value: 42 });
});

test('export default arrow function', () => {
  const src = `export default (x) => x * 2;`;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.default.type).toBe('func');
});

// ===== Inline Exports =====

test('export const declaration', () => {
  const src = `export const x = 42;`;
  const bundle = compile(src);
  
  expect(bundle.exports).toContainEqual({ exported: 'x', local: 'x' });
});

test('export let declaration', () => {
  const src = `export let y = 'hello';`;
  const bundle = compile(src);
  
  expect(bundle.exports).toContainEqual({ exported: 'y', local: 'y' });
});

test('export function declaration', () => {
  const src = `export function greet(name) { return 'Hello ' + name; }`;
  const bundle = compile(src);
  
  expect(bundle.exports).toContainEqual({ exported: 'greet', local: 'greet' });
});

test('export class declaration', () => {
  const src = `export class Point { constructor(x, y) { this.x = x; this.y = y; } }`;
  const bundle = compile(src);
  
  expect(bundle.exports).toContainEqual({ exported: 'Point', local: 'Point' });
});

test('inline export const retrieves value', () => {
  const src = `export const answer = 42;`;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.answer).toEqual({ type: 'num', value: 42 });
});

test('inline export function is callable', () => {
  const src = `export function add(a, b) { return a + b; }`;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.add.type).toBe('func');
});

test('inline export class is valid', () => {
  const src = `export class Counter { constructor() { this.count = 0; } }`;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.Counter.type).toBe('class');
});

// ===== Re-exports =====

test('parse re-export from module', () => {
  const src = `export { a, b } from './module';`;
  const bundle = compile(src);
  
  expect(bundle.reExports).toHaveLength(1);
  expect(bundle.reExports[0].source).toBe('./module');
  expect(bundle.reExports[0].specifiers).toContainEqual({ local: 'a', exported: 'a' });
  expect(bundle.reExports[0].specifiers).toContainEqual({ local: 'b', exported: 'b' });
});

test('parse re-export with renaming', () => {
  const src = `export { x as renamed_x, y } from './module';`;
  const bundle = compile(src);
  
  expect(bundle.reExports).toHaveLength(1);
  expect(bundle.reExports[0].specifiers).toContainEqual({ local: 'x', exported: 'renamed_x' });
  expect(bundle.reExports[0].specifiers).toContainEqual({ local: 'y', exported: 'y' });
});

// ===== Mixed Exports =====

test('module with both named and default export', () => {
  const src = `
    const x = 42;
    export { x };
    export default 'default value';
  `;
  const bundle = compile(src);
  
  expect(bundle.exports).toContainEqual({ exported: 'x', local: 'x' });
  expect(bundle.defaultExport).toBeTruthy();
  expect(bundle.defaultExport.type).toBe('Literal');
});

test('getExports with both named and default', () => {
  const src = `
    const x = 42;
    export { x };
    export default 'default value';
  `;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.x).toEqual({ type: 'num', value: 42 });
  expect(exports.map.default).toEqual({ type: 'str', value: 'default value' });
});

test('module with inline and named exports', () => {
  const src = `
    export const a = 1;
    const b = 2;
    export { b };
  `;
  const bundle = compile(src);
  
  expect(bundle.exports).toContainEqual({ exported: 'a', local: 'a' });
  expect(bundle.exports).toContainEqual({ exported: 'b', local: 'b' });
});

test('module with inline export and default', () => {
  const src = `
    export function helper() { return 42; }
    export default 'main export';
  `;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.helper.type).toBe('func');
  expect(exports.map.default).toEqual({ type: 'str', value: 'main export' });
});

test('multiple exports including functions, classes, and default', () => {
  const src = `
    export const x = 10;
    export function f() { return x * 2; }
    export class C { }
    export default 'default';
  `;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.x).toEqual({ type: 'num', value: 10 });
  expect(exports.map.f.type).toBe('func');
  expect(exports.map.C.type).toBe('class');
  expect(exports.map.default).toEqual({ type: 'str', value: 'default' });
});

test('named exports with renaming', () => {
  const src = `
    const internal_name = 42;
    export { internal_name as externalName };
  `;
  const bundle = compile(src);
  const env = createDefaultEnv();
  const vm = createVM(bundle, { env });
  vm.runMain();
  
  const exports = vm.getExports();
  expect(exports.map.externalName).toEqual({ type: 'num', value: 42 });
});
