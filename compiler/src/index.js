import lex from './lexer.js';
import parse from './parser.js';
import compileAst from './compiler.js';

export { lex, parse, compileAst };

export function compileSource(source) {
  return compileAst(parse(lex(source)));
}
