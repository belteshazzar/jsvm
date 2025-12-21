
import { expect, test } from 'vitest';

import lex from '../src/lexer.js';
import parse from '../src/parser.js';
import compile from '../src/compiler.js';
import createVM from '../src/vm.js';

import { run } from '../main.js';

const sample = `
// Arrays: shift, unshift, splice, reverse, sort (no comparator), concat
let a = [3,1,2];
print("a=" + a);
print("shift=" + a.shift());
print("after shift a=" + a);
print("unshift returns len=" + a.unshift(9,8));
print("after unshift a=" + a);
print("splice(1,2,'x','y') removed=" + a.splice(1,2));
print("after splice a=" + a);
print("concat([7,7], 99)=" + a.concat([7,7], 99));
print("reverse=" + a.reverse());
print("sort=" + a.sort());
print("join='|': " + a.join("|"));

// Classes / methods sanity
class Base {
  constructor(x) {
    this.x=x;
  }
    
  who() {
    return "Base(" + this.x + ")";
  }
}

class Sub extends Base {
  constructor(x,y) {
    super(x);
    this.y=y;
  }

  who() {
    return "Sub(" + this.x + "," + this.y + ")";
  }
}

let s = new Sub(5,6);
print(s.who());
`;

test('sample steps', () => {

  const toks = lex(sample);
  expect(toks).not.toBeNull();
  const ast = parse(toks);
  expect(ast).not.toBeNull();
  const bc = compile(ast);
  expect(bc).not.toBeNull();

  const output = [];
  const vm = createVM(bc, {
    onPrint: s => {
      output.push(s);
    }
  });
  expect(vm).not.toBeNull();

  const ret = vm.runMain();
  console.log('Program exited with', ret);
  const out = output.join('\n');
  console.log(out);

});

test('sample run()', () => {

  const output = [];
  const ret = run(sample, {
    onPrint: s => {
      output.push(s);
    }
  });
  console.log('Program exited with', ret);
  const out = output.join('\n');
  console.log(out);

});