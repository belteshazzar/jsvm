# Opcodes

This is the authoritative opcode list for the current VM.

Conventions:
- Stack effects are written as: `(..., a, b) -> (..., result)`
- `a`/`b` refer to instruction operands (`instr.a`, `instr.b`).
- Instructions may also carry optional source location `loc` (used for VM error reporting).

## Stack / constants

- `CONST a`: push constant at `functions[frame.funcIndex].consts[a]`.
  - Stack: `(...) -> (..., value)`
- `POP`: pop top.
  - Stack: `(..., v) -> (...)`
- `DUP`: duplicate top.
  - Stack: `(..., v) -> (..., v, v)`

## Names / environments

- `LOAD_NAME a`: push resolved variable value.
- `STORE_NAME a`: assign to existing variable (does not pop).
- `DEFINE_NAME a`: define variable in current env, consuming value.
  - Stack: `(..., v) -> (...)`
- `DEFINE_CONST a`: define constant binding in current env, consuming value.
  - Stack: `(..., v) -> (...)`
  - Reassignment via `STORE_NAME a` must throw.

### Scopes (block scoping)

- `SCOPE_PUSH`: create a new child lexical environment for the current frame.
- `SCOPE_POP`: restore the parent lexical environment.

## Control flow

- `JMP a`: set `ip = a`.
- `JMP_IF_FALSE a`: if top is falsy, set `ip = a` (does not pop).
- `JMP_IF_TRUE a`: if top is truthy, set `ip = a` (does not pop).

## Unary

- `NOT`: logical not.
- `NEG`: numeric negation (expects `num`).

## Binary arithmetic

- `ADD`, `SUB`, `MUL`, `DIV`, `MOD`
  - `ADD` concatenates if either operand is `str`.

## Comparisons

- `LT`, `LE`, `GT`, `GE`, `EQ`, `NE`, `SEQ`, `SNE`

Note: `EQ/NE` are type-strict in this implementation (values of different `type` are never equal).

`SEQ/SNE` implement JavaScript-like strict equality over boxed values:
- Different `type` is always not equal.
- Primitives compare by `value`.
- `null` equals `null`; `undef` equals `undef`; `null` is not equal to `undef`.
- Objects/arrays/instances/classes/functions compare by identity.

## Objects / arrays

- `MAKE_OBJ`: push empty object.
- `GET_PROP`: pop key + recv, push recv[key].
- `SET_PROP`: pop value + key + recv, set and push value.

- `MAKE_ARR`: push empty array.
- `APPEND_ELEM`: pop value + arr, push value.
- `GET_ELEM`: pop key + recv, push recv[key].
- `SET_ELEM`: pop value + key + recv, set and push value.

## Functions / calls

- `MAKE_FUNCTION a`: create closure from `functions[a]` capturing current env.
- `CALL a`: call with `a` args.
- `CALL_PROP a`: call recv[prop] with `a` args (binds `this` to recv).
- `CALL_ELEM a`: call recv[key] with `a` args (binds `this` to recv).
- `RET`: return from current frame.

## Classes

- `MAKE_CLASS a`: instantiate class metadata from `classes[a]` capturing current env.
- `NEW a`: instantiate class with `a` args.

### `super`

- `CALL_SUPER_CTOR a`: call superclass constructor with `a` args.
- `CALL_SUPER_METHOD a b`: call superclass method named `a` with `b` args.
  - `a` is the method name (string), `b` is the arg count (number).

## `this`

- `LOAD_THIS`: push current `this`.
  - In derived constructors, throws if used before `super()`.
