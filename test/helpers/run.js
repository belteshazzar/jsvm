import lex from '../../src/core/lexer.js';
import parse from '../../src/core/parser.js';
import compile from '../../src/core/compiler.js';
import createVM from '../../src/core/vm.js';
import { createDefaultEnv } from '../../src/core/env.js';

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
  
  // Pass requestImport through to the VM if provided
  if (typeof options.requestImport === 'function') {
    env.requestImport = options.requestImport;
  }
  
  const vm = createVM(bc, { env });
  const ret = vm.runMain();
  return { ret, output, bc };
}

export function printed(src) {
  return runAndCapture(src).output;
}
