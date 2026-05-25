# jsvm-compiler

This package compiles source text into jsvm bytecode bundles.

Public API:
- `lex(source)`
- `parse(tokens)`
- `compileAst(ast)`
- `compileSource(source)`

CLI:
- `node bin/jsc --file ./prog.js --out ./prog.bc`
- `echo 'print(1+2);' | node bin/jsc --out ./prog.bc`
- `node bin/jsc --describe-bytecode ./prog.bc`

This package is intentionally independent from any VM runtime implementation.
