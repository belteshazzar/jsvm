import lex from '../../src/lexer.js';
import parse from '../../src/parser.js';
import compile from '../../src/compiler.js';
import createVM from '../../src/vm.js';
import { createDefaultEnv } from '../../src/env.js';

export function compileSource(src) {
  const toks = lex(src);
  const ast = parse(toks);
  return compile(ast);
}

export function runAndCapture(src, options = {}) {
  const output = [];
  const bc = compileSource(src);
  const env = createDefaultEnv({
    onPrint: s => {
      output.push(s);
      options.onPrint?.(s);
    }
  });
  const vm = createVM(bc, { env });
  const ret = vm.runMain();
  return { ret, output, bc };
}

export function printed(src) {
  return runAndCapture(src).output;
}
