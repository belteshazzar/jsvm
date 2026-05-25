import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('Array methods: shift/unshift/splice/concat/reverse/sort/join', () => {
  const src = `
let a = [3,1,2];
print("a=" + a);
print("shift=" + a.shift());
print("after shift a=" + a);
print("unshift returns len=" + a.unshift(9,8));
print("after unshift a=" + a);
print("splice(1,2,'x','y') removed=" + a.splice(1,2,'x','y'));
print("after splice a=" + a);
print("concat([7,7], 99)=" + a.concat([7,7], 99));
print("reverse=" + a.reverse());
print("sort=" + a.sort());
print("join='|': " + a.join("|"));
`;

  const out = printed(src);
  expect(out).toEqual([
    'a=[3, 1, 2]',
    'shift=3',
    'after shift a=[1, 2]',
    'unshift returns len=4',
    'after unshift a=[9, 8, 1, 2]',
    "splice(1,2,'x','y') removed=[8, 1]",
    'after splice a=[9, x, y, 2]',
    'concat([7,7], 99)=[9, x, y, 2, 7, 7, 99]',
    'reverse=[2, y, x, 9]',
    'sort=[2, 9, x, y]',
    "join='|': 2|9|x|y",
  ]);
});

test('Array methods: push/pop/indexOf/includes', () => {
  const src = `
let a = [1,2];
print('push=' + a.push(3,4));
print('after push a=' + a);
print('pop=' + a.pop());
print('after pop a=' + a);
print('indexOf(2)=' + a.indexOf(2));
print('indexOf(99)=' + a.indexOf(99));
print('includes(1)=' + a.includes(1));
print('includes(99)=' + a.includes(99));
`;

  const out = printed(src);
  expect(out).toEqual([
    'push=4',
    'after push a=[1, 2, 3, 4]',
    'pop=4',
    'after pop a=[1, 2, 3]',
    'indexOf(2)=1',
    'indexOf(99)=-1',
    'includes(1)=true',
    'includes(99)=false',
  ]);
});
