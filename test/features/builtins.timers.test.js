import { test, expect } from 'vitest';
import { printed, runAndCapture } from '../helpers/run.js';

test('setTimeout with callback is called', () => {
  const src = `
    let called = false;
    setTimeout(() => { called = true; print(called); }, 0);
  `;
  
  const { output, unhandledRejections } = runAndCapture(src);
  expect(output).toEqual(['true']);
  expect(unhandledRejections).toEqual([]);
});

test('setTimeout returns a number timer ID', () => {
  const src = `
    const id = setTimeout(() => {}, 0);
    print(typeof id);
  `;
  
  expect(printed(src)).toEqual(['num']);
});

test('setTimeout with 0 delay executes via microtask', () => {
  const src = `
    let result = 0;
    setTimeout(() => { result = 42; }, 0);
    setTimeout(() => print(result), 0);
  `;
  
  expect(printed(src)).toEqual(['42']);
});

test('setTimeout with function reference', () => {
  const src = `
    function greet() { print('hello'); }
    setTimeout(greet, 0);
  `;
  
  expect(printed(src)).toEqual(['hello']);
});

test('setTimeout with arrow function', () => {
  const src = `
    setTimeout(() => print('arrow'), 0);
  `;
  
  expect(printed(src)).toEqual(['arrow']);
});

test('multiple setTimeout calls execute in order', () => {
  const src = `
    setTimeout(() => print(1), 0);
    setTimeout(() => print(2), 0);
    setTimeout(() => print(3), 0);
  `;
  
  expect(printed(src)).toEqual(['1', '2', '3']);
});

test('setTimeout delay parameter is a number', () => {
  const src = `
    const id = setTimeout(() => {}, 100);
    print(id > 0 ? 'positive' : 'zero');
  `;
  
  expect(printed(src)).toEqual(['positive']);
});

test('setTimeout with non-numeric delay defaults to 0', () => {
  const src = `
    let called = false;
    setTimeout(() => { called = true; }, 'notanumber');
    setTimeout(() => print(called), 0);
  `;
  
  expect(printed(src)).toEqual(['true']);
});

test('nested setTimeout calls execute in sequence', () => {
  const src = `
    setTimeout(() => { print(1); setTimeout(() => print(2), 0); }, 0);
  `;
  
  expect(printed(src)).toEqual(['1', '2']);
});

test('setTimeout with function call in callback', () => {
  const src = `
    function add(a, b) { print(a + b); }
    setTimeout(() => add(2, 3), 0);
  `;
  
  expect(printed(src)).toEqual(['5']);
});

test('setTimeout inside Promise callback', () => {
  const src = `
    let order = '';
    Promise.resolve().then(() => { order = 'p'; });
    setTimeout(() => print(order), 0);
  `;
  
  expect(printed(src)).toEqual(['p']);
});

test('setTimeout with multiple sequential updates', () => {
  const src = `
    let x = 0;
    setTimeout(() => { x = 1; }, 0);
    setTimeout(() => { x = x + 1; }, 0);
    setTimeout(() => { x = x + 1; }, 0);
    setTimeout(() => print(x), 0);
  `;
  
  expect(printed(src)).toEqual(['3']);
});

test('setTimeout modifying object properties', () => {
  const src = `
    const obj = { value: 0 };
    setTimeout(() => { obj.value = 10; }, 0);
    setTimeout(() => { obj.value = obj.value + 5; }, 0);
    setTimeout(() => print(obj.value), 0);
  `;
  
  expect(printed(src)).toEqual(['15']);
});

test('setTimeout with callback using closure', () => {
  const src = `
    const x = 42;
    const fn = () => print(x);
    setTimeout(fn, 0);
  `;
  
  expect(printed(src)).toEqual(['42']);
});


test('setTimeout with arguments passed to callback', () => {
  const src = `
    function add(a, b) { print(a + b); }
    setTimeout(() => add(2, 3), 0);
  `;
  
  expect(printed(src)).toEqual(['5']);
});

test('setTimeout respects delay ordering - lower delay executes first', () => {
  const src = `
    setTimeout(() => print("Timeout 2"), 2);
    setTimeout(() => print("Timeout 1"), 0);
  `;
  
  expect(printed(src)).toEqual(['Timeout 1', 'Timeout 2']);
});

test('setTimeout with multiple different delays executes in delay order', () => {
  const src = `
    setTimeout(() => print("Third"), 5);
    setTimeout(() => print("First"), 0);
    setTimeout(() => print("Second"), 2);
  `;
  
  expect(printed(src)).toEqual(['First', 'Second', 'Third']);
});

