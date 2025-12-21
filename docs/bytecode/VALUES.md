# Value Model

The VM operates on boxed values with a `{type, ...}` tag.

## Primitive values

- `{ type: 'num', value: number }`
- `{ type: 'str', value: string }`
- `{ type: 'bool', value: boolean }`
- `{ type: 'null' }`
- `{ type: 'undef' }` (`undefined`)

## Null vs undefined semantics

This VM aims to feel like JavaScript:

- Missing object properties yield `undefined`.
- Missing array indices yield `undefined`.
- `null` is only produced explicitly by the `null` literal (or by code that stores `{type:'null'}` into objects/arrays).

## Compound values

- `{ type: 'obj', map: Record<string, Value> }`
  - Objects are created with `Object.create(null)` in the JS VM implementation.
  - Missing properties currently yield `{type:'null'}`.
- `{ type: 'arr', items: Value[] }`
  - Missing indices currently yield `{type:'null'}`.

## Callable values

- `{ type: 'func', name: string, funcIndex: number, env: Env }`
- `{ type: 'native', name: string, arity: number | null, call: (vm,args,thisObj)=>Value }`

## Classes and instances

- `{ type: 'class', name: string, ctor: func|null, proto: Proto, super: class|null }`
- `{ type: 'instance', cls: class, fields: Record<string,Value>, proto: Proto }`

This repo implements method dispatch via prototype lookup on `proto`.
