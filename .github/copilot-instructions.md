# Copilot instructions for `jsvm`

## Project overview (read this first)
`jsvm` is a small JS-like language implemented as:
- `src/lexer.js`: tokenizes a *safe subset* of JavaScript (no host APIs).
- `src/parser.js`: recursive-descent parser producing a simple AST.
- `src/compiler.js`: lowers AST to a JSON-serializable bytecode “bundle”.
- `src/vm.js`: stack-based VM executing that bundle.

Public entrypoints:
- `main.js`: `run(src, { onPrint })` → returns a boxed VM value.
- `bin/jsvm`: CLI that runs from stdin or `--file` and prints via `onPrint`.

## Core conventions you must follow
- **Boxed values everywhere**: runtime values are tagged objects like `{type:'num', value:1}`.
  - Spec: `docs/bytecode/VALUES.md`.
  - Printer: `toStringV()` in `src/vm.js` (used by `print`).
- **Bytecode is versioned + documented**:
  - Bundle shape: `docs/bytecode/FORMAT.md`.
  - Opcodes/stack effects: `docs/bytecode/OPCODES.md`.
  - VM rejects unknown versions in `createVM()` (`bundle.bytecodeVersion !== 1`).
- **Locations for good errors**: compiler emits `loc` per instruction (see `withLoc()` / `emit()` in `src/compiler.js`).
  - VM errors come from `panic()` in `src/common.js` using `setLastInstr()`.
  - When adding syntax/features, propagate `loc` so tests like `test/features/error.location.test.js` keep passing.
- **Lexical environments + block scoping**: implemented in VM via `Env` + `SCOPE_PUSH`/`SCOPE_POP`.
  - Compiler emits scopes for `{ ... }` blocks (see `case 'Block'` in `src/compiler.js`).
- **`this`/classes/super have explicit VM rules**:
  - `LOAD_THIS` throws in derived constructors before `super()` (`src/vm.js`).
  - `super(...)` and `super.method(...)` are parsed into special AST nodes and compiled into `CALL_SUPER_*` opcodes.

## Workflow (how to run/verify changes)
- `npm test` runs Vitest (feature-level tests in `test/features/*.test.js`).
- `npm run test:watch` starts a watch mode.
- CLI: `echo 'print(1+2);' | node bin/jsvm` or `node bin/jsvm --file ./prog.js`.
- API: `run()` is tested in `test/features/smoke.run-api.test.js`.

## Project-specific patterns (avoid surprising changes)
- **Instruction shape**: instructions are objects `{ op, a, b, loc }` (compiler) even though spec shows `{op,a,b}`.
- **Constants**: `compiler.js` interns constants via `constIndex()` (JSON string compare); preserve this behavior.
- **Equality semantics**: `==/!=` are type-strict here; `===/!==` use `strictEq()` in `src/vm.js` (see `docs/bytecode/OPCODES.md`).
- **No callback-support in sandboxed Array methods**: `Array.sort` rejects comparator callbacks; methods are implemented as `native` callables (see `ARRAY_METHODS` + `arrayMethodNative()` in `src/vm.js`).

## Where to implement new language features
- Token-level: add/adjust in `src/lexer.js`.
- Grammar + AST nodes: `src/parser.js`.
- Codegen + opcodes: `src/compiler.js` (update `docs/bytecode/OPCODES.md` if you change opcodes/semantics).
- Runtime behavior: `src/vm.js`.
- Tests: add a focused file under `test/features/` (pattern: one feature per test file).

## Quick examples to mirror
- Implementing a new expression form: see ternary (`Conditional`) in `src/parser.js` + `src/compiler.js` and tests in `test/features/expr.ternary.test.js`.
- Exposing output: `print` is a builtin `native` that uses `onPrint` (see `builtins.print` in `src/vm.js`).
