
import lex from "./src/lexer.js";
import parse from "./src/parser.js";
import compileAst from "./src/compiler.js";
import createVM from "./src/vm.js";
import { decodeBundle, encodeBundle } from "./src/bytecode/io.js";
import { createDefaultEnv } from "./src/env.js";

export function compile(src) {
  const toks = lex(src);
  const ast = parse(toks);
  return compileAst(ast);
}

export function runBundle(bundleOrJson, options = { onPrint: s => {} }) {
  const bundle =
    typeof bundleOrJson === 'string' ? JSON.parse(bundleOrJson) : bundleOrJson;
  const env = createDefaultEnv({ onPrint: s => options.onPrint(s) });
  const vm = createVM(bundle, { env });
  return vm.runMain();
}

export function compileBinary(src) {
  const bundle = compile(src);
  return encodeBundle(bundle);
}

export function runBundleBuffer(buf, options = { onPrint: s => {} }) {
  const bundle = decodeBundle(buf);
  return runBundle(bundle, options);
}

export function run(src, options = {
  onPrint: s => {}
}) {
  const bc = compile(src);
  return runBundle(bc, options);
}