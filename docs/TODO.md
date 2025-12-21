# TODO / Roadmap

This document tracks planned work for `jsvm`: a safe subset of JavaScript for running untrusted template and backend logic.

Design goals:
- Safe-by-default execution (no host escape, no dynamic codegen)
- Familiar “feels like JavaScript” ergonomics
- Tight, per-feature execution tests
- Stable, documented bytecode for alternative VM implementations

Non-goals (intentionally omitted from the subset):
- Async/await, Promises
- Generators / `yield`
- Dynamic `import` / unrestricted module access
- `eval`, `new Function`, reflective escapes

---

## Phase A — Core ergonomics (high impact, low risk)

### Language features
- [x] Real block scoping for `{}` (lexical environments)
- [x] `const` declarations and const-assignment errors
- [x] `undefined` literal + JS-like `null` vs `undefined` semantics for “missing”
- [x] Strict equality: `===` and `!==`
- [x] Ternary operator: `cond ? a : b`
- [x] Nullish coalescing `??`
- [x] Optional chaining `?.` (property + call variants as feasible)
- [x] Template literals (restricted): `` `Hello ${x}` ``

### Safety/UX
- [x] Standardize error type and include location (`line:col`) where possible
- [ ] Make runtime error messages stable enough for tests

### Test coverage
- [x] Split tests per feature (`test/features/*`)
- [x] Add test harness (`test/helpers/run.js`)
- [ ] Add per-feature negative tests (runtime error assertions) for each construct

---

## Phase B — Control flow & functions

### Language features
- [x] Function expressions
- [ ] Arrow functions (no `this` binding; closure-only)
- [ ] `for (init; cond; post)` loop (compile to while)
- [ ] `break` / `continue`
- [ ] `switch` (optional)

### Test coverage
- [ ] Short-circuit tests for `&&`/`||` with side effects
- [ ] Loop tests (break/continue correctness)
- [ ] Closure-capture tests (shadowing, outer variable capture)

---

## Phase C — Curated standard library

### Builtins (curated, sandbox-only operations)
- [ ] `Math` (pure numeric functions only)
- [ ] `JSON.parse` / `JSON.stringify` (sandbox-value encoding only)
- [ ] String methods (curated): `slice`, `includes`, `indexOf`, `toUpperCase`, …
- [ ] Array method expansions (only those that cannot escape via callbacks, or add callback support with a careful design)

### Safety
- [ ] Explicit denylist tests: ensure `eval`, `Function`, `globalThis`, `process` cannot be referenced
- [ ] Confirm `Object.create(null)` is preserved for VM objects (no prototype pollution)

### Import (from allowed list)
- [ ] `import` for known packages that are whitelisted in the VM

---

## Bytecode stability (lockstep with implementation)

### Spec documents
- [x] `docs/bytecode/FORMAT.md`
- [x] `docs/bytecode/OPCODES.md`
- [x] `docs/bytecode/VALUES.md`

### Next steps
- [ ] Add `bytecodeVersion` to bundle output and verify in VM loader
- [ ] Define canonical JSON encoding (stable ordering; e.g. instruction tuples)
- [ ] Add “golden vectors” fixtures (source → bytecode → output) for cross-language VMs
- [ ] Document semantics decisions explicitly (e.g. missing property returns `null` vs `undefined`)

---

## Security-focused backlog

- [ ] Put hard limits on execution (step budget / time budget)
- [ ] Memory limits (max array length / max object properties / string size)
- [ ] Prevent pathological programs (e.g. huge constants, deep recursion)
- [ ] Deterministic resource accounting exposed as config

---

## Notes / tracking

- Tests should be added *per feature* before (or along with) the implementation.
- Bytecode docs should change in the same PR as any opcode/value/semantic changes.
