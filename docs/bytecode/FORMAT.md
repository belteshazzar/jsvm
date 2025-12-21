# Bytecode Format

This document describes the stable *interchange* format for the `jsvm` compiler output.

## Bundle structure

A compiled program is a JSON-serializable object:

```js
{
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
  consts: ConstValue[],
  code: Instruction[]
}
```

- `consts` is a constant pool indexed by `CONST a`.
- `code` is a linear instruction stream.

### `Instruction`

Currently encoded as:

```js
{ op: string, a: any | null, b: any | null }
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

The current repo does not yet embed an explicit `bytecodeVersion` field.

Planned: add `bytecodeVersion: 1` at the top-level bundle and enforce it in the VM loader so alternative implementations can reject incompatible formats deterministically.
