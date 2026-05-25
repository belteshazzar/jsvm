# jsvm-compiler

This package compiles source text into jsvm bytecode bundles.

Public API:
- `lex(source)`
- `parse(tokens)`
- `compileAst(ast)`
- `compileSource(source)`

This package is intentionally independent from any VM runtime implementation.
