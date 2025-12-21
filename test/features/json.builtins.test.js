import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';

test('JSON.stringify: primitives', () => {
  expect(printed('print(JSON.stringify(42));')).toEqual(['42']);
  expect(printed('print(JSON.stringify("hi"));')).toEqual(['"hi"']);
  expect(printed('print(JSON.stringify(true));')).toEqual(['true']);
  expect(printed('print(JSON.stringify(null));')).toEqual(['null']);
});

test('JSON.stringify: objects/arrays', () => {
  expect(printed('print(JSON.stringify({a:1, b:2}));')).toEqual(['{"a":1,"b":2}']);
  expect(printed('print(JSON.stringify([1,2,3]));')).toEqual(['[1,2,3]']);
});

test('JSON.parse: primitives', () => {
  expect(printed('print(typeof JSON.parse("42"));')).toEqual(['num']);
  expect(printed('print(typeof JSON.parse("true"));')).toEqual(['bool']);
  expect(printed('print(typeof JSON.parse("null"));')).toEqual(['null']);
  expect(printed('print(typeof JSON.parse("\\"hi\\""));')).toEqual(['str']);
});

test('JSON.parse: objects/arrays', () => {
  expect(printed('print(typeof JSON.parse("[1,2,3]"));')).toEqual(['arr']);
  expect(printed('print(typeof JSON.parse("{\\"a\\":1}"));')).toEqual(['obj']);
  expect(printed('print(JSON.parse("[1,2,3]")[1]);')).toEqual(['2']);
  expect(printed('print(JSON.parse("{\\"a\\":1}").a);')).toEqual(['1']);
});
