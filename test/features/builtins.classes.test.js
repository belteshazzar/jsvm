import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';

test('Object constructor', () => {
  expect(printed('print(typeof Object());')).toEqual(['obj']);
  expect(printed('let o = {a:1}; let x = Object(o); print(x === o);')).toEqual(['true']);
  expect(printed('let x = Object(1); print(typeof x);')).toEqual(['obj']);
});

test('String constructor', () => {
  expect(printed('print(String(123));')).toEqual(['123']);
  expect(printed('print(typeof String(null));')).toEqual(['str']);
  expect(printed('let s = new String("abc"); print(typeof s); print(s.toUpperCase());')).toEqual(['instance','ABC']);
  expect(printed('print("hi".toUpperCase());')).toEqual(['HI']);
  expect(printed('print("abc".charAt(1));')).toEqual(['b']);
});

test('Number constructor', () => {
  expect(printed('print(Number("5"));')).toEqual(['5']);
  expect(printed('print(Number("foo"));')).toEqual(['NaN']);
  expect(printed('print(typeof Number(true));')).toEqual(['num']);
  expect(printed('let n = new Number(7); print(typeof n); print(n.toString());')).toEqual(['instance','7']);
});

test('Array constructor and isArray', () => {
  expect(printed('print(typeof Array());')).toEqual(['arr']);
  expect(printed('let a = Array(3); print(a.length);')).toEqual(['3']);
  expect(printed('let a = Array(1,2,3); print(a[1]);')).toEqual(['2']);
  expect(printed('print(Array.isArray([1,2]));')).toEqual(['true']);
  expect(printed('print(Array.isArray({}));')).toEqual(['false']);
  expect(printed('let a = new Array(2); print(a.length);')).toEqual(['2']);
  expect(printed('let a = new Array(1,2); a.push(3); print(a.join(","));')).toEqual(['1,2,3']);
});
