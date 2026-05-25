# Split Architecture

The project is now split into three standalone folders that can be moved into separate repositories:

1. `bytecode-definition/`
2. `compiler/`
3. `vm-js/`

Compatibility wrappers were left in `src/core/*` and `src/bytecode/io.js` so existing tests and entrypoints continue to work.

## Intended ownership

- `bytecode-definition/`: bytecode versioning, format docs, binary bundle I/O
- `compiler/`: lexer, parser, AST-to-bytecode lowering
- `vm-js/`: JavaScript VM runtime and default sandbox environment

## Suggested publish/extract flow

1. Initialize a Git repo in each folder.
2. Keep package names:
   - `jsvm-bytecode-definition`
   - `jsvm-compiler`
   - `jsvm-vm-js`
3. Publish in order: bytecode-definition, compiler, vm-js.
4. In consuming apps, compile with `jsvm-compiler` and run the produced bundle on either `jsvm-vm-js` or your C runtime.
