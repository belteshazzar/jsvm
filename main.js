
import lex from "./src/lexer.js";
import parse from "./src/parser.js";
import compileAst from "./src/compiler.js";
import createVM from "./src/vm.js";
import { decodeBundle, encodeBundle } from "./src/bytecode/io.js";

export function compile(src) {
  const toks = lex(src);
  const ast = parse(toks);
  return compileAst(ast);
}

export function runBundle(bundleOrJson, options = { onPrint: s => {} }) {
  const bundle =
    typeof bundleOrJson === 'string' ? JSON.parse(bundleOrJson) : bundleOrJson;
  const vm = createVM(bundle, {
    onPrint: s => options.onPrint(s),
  });
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