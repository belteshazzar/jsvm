# Bytecode Format

This document describes the stable *interchange* format for the `jsvm` compiler output.

## Bundle structure

A compiled program is a JSON-serializable object:

```js
{
  bytecodeVersion: 1,
  functions: FunctionDef[],
  classes: ClassDef[]
}
```

### `FunctionDef`

```js
{
  name: string,
  params: string[],
  arity: number,
  async: boolean,
  awaitSites: number[],
  consts: ConstValue[],
  code: Instruction[]
}
```

- `async` indicates if the function is async (contains `await` expressions).
- `awaitSites` is an array of instruction indices where `await` expressions occur.
- `consts` is a constant pool indexed by `CONST a`.
- `code` is a linear instruction stream.

### `Instruction`

Currently encoded as:

```js
{ op: string, a: any | null, b: any | null }
```

Note: the current JS compiler/VM also attaches source locations for better errors:

```js
{ op: string, a: any | null, b: any | null, loc: { line: number, col: number } | null }
```

Note: for cross-language VMs, you should treat `op` as an enum and `a`/`b` as operands with meanings defined per-opcode (see `OPCODES.md`).

### `ClassDef`

```js
{
  name: string,
  superName: string | null,
  ctorIndex: number | null,
  methods: { name: string, funcIndex: number }[]
}
```

- `ctorIndex` and each `funcIndex` refer into `functions[]`.

## Versioning

- `bytecodeVersion` is a required integer.
- Current version: `1`.
- VMs must reject unknown versions.
