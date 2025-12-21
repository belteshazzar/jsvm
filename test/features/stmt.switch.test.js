import { test, expect } from 'vitest';
import { printed } from '../helpers/run.js';

test('switch: basic match', () => {
  const out = printed(`
    let x = 2;
    switch (x) {
      case 1: print('one'); break;
      case 2: print('two'); break;
      case 3: print('three'); break;
      default: print('other');
    }
  `);
  expect(out).toEqual(['two']);
});

test('switch: default when no case matches', () => {
  const out = printed(`
    let x = 42;
    switch (x) {
      case 1: print('one'); break;
      default: print('other');
    }
  `);
  expect(out).toEqual(['other']);
});

test('switch: fallthrough without break', () => {
  const out = printed(`
    let x = 1;
    switch (x) {
      case 1:
        print('a');
      case 2:
        print('b');
        break;
      default:
        print('c');
    }
  `);
  expect(out).toEqual(['a','b']);
});

test('switch: break skips later cases and default', () => {
  const out = printed(`
    let x = 2;
    switch (x) {
      case 1:
        print('one');
        break;
      case 2:
        print('two');
        break;
      case 3:
        print('three');
        break;
      default:
        print('other');
    }
    print('after');
  `);
  expect(out).toEqual(['two','after']);
});

test('switch: nested switch respects inner break only', () => {
  const out = printed(`
    let x = 1;
    let y = 2;
    switch (x) {
      case 1:
        switch (y) {
          case 2:
            print('inner');
            break; // should break only inner switch
          default:
            print('inner-default');
        }
        print('outer');
        break; // break outer switch
      default:
        print('outer-default');
    }
  `);
  expect(out).toEqual(['inner','outer']);
});
