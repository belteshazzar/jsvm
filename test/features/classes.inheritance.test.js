import { expect, test } from 'vitest';
import { printed } from '../helpers/run.js';

test('Classes: constructor, extends, super(), override method', () => {
  const src = `
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

  expect(printed(src)).toEqual(['Sub(5,6)']);
});
