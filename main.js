
import lex from "./src/lexer.js";
import parse from "./src/parser.js";
import compile from "./src/compiler.js";
import createVM from "./src/vm.js";

export function run(src, options = {
  onPrint: s => {}
}) {
  const toks = lex(src);
  const ast = parse(toks);
  const bc = compile(ast);

  const vm = createVM(bc, {
    onPrint: s => options.onPrint(s)
  });

  return vm.runMain();
}