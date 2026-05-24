# TODO / Roadmap

This document tracks planned work for `jsvm`: a safe subset of JavaScript for running untrusted template and backend logic.

Design goals:
- Safe-by-default execution (no host escape, no dynamic codegen)
- Familiar “feels like JavaScript” ergonomics
- Tight, per-feature execution tests
- Stable, documented bytecode for alternative VM implementations

Non-goals (intentionally omitted from the subset):
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
- [x] Arrow functions (no `this` binding; closure-only)
- [x] `for (init; cond; post)` loop (compile to while)
- [x] `for..in` loop over property keys
- [x] `for..of` loop over property values
- [x] `break` / `continue`
- [x] `switch`

### Test coverage
- [x] Short-circuit tests for `&&`/`||` with side effects
- [x] Loop tests (break/continue correctness)
- [ ] Closure-capture tests (shadowing coverage still missing; outer capture basics are covered)

---

## Phase C — Curated standard library

### Builtins (curated, sandbox-only operations)
- [x] `Math` (pure numeric functions only)
- [x] `JSON.parse` / `JSON.stringify` (sandbox-value encoding only)
- [x] `console` object (`log`/`info`/`warn`/`error`)
- [x] Core `Promise` (`Promise.resolve`/`Promise.reject`, `then`/`catch`/`finally`, constructor executors, unhandled rejection policy) — tests: `test/features/promise.core-runtime.test.js`, `test/features/promise.unhandled-rejection.test.js`
- [x] Timers: `setTimeout(callback, delayMs)` with delay ordering — tests: `test/features/builtins.timers.test.js`
- [ ] String methods (curated): `slice`, `includes`, `indexOf`, `toUpperCase`, … (currently: `toUpperCase`, `toLowerCase`, `charAt`)
- [ ] Array method expansions (currently includes `push`, `pop`, `slice`, `indexOf`, `includes`, `join`, `shift`, `unshift`, `splice`, `reverse`, `sort` (no comparator callback), `concat`)

### Safety
- [x] Explicit denylist tests: ensure `eval`, `Function`, `globalThis`, `process` cannot be referenced
- [ ] Confirm `Object.create(null)` is preserved for VM objects (no prototype pollution)

### Import (from allowed list)
- [ ] `import` for known packages that are whitelisted in the VM

---

## Phase D — Async runtime & language

### Language/runtime
- [x] `async function` syntax (declaration + expression) — tests: `test/features/syntax.async-await.parser.test.js`
- [x] `await` syntax + precedence (unary) — tests: `test/features/syntax.async-await.parser.test.js`
- [x] Compiler lowering for `await` (`AWAIT`) with async metadata — tests: `test/features/async.compiler-lowering.test.js`
- [x] VM continuation/suspension for `AWAIT` via microtask queue — tests: `test/features/async.await-runtime.test.js`
- [x] Async function calls return promises; runtime errors reject async result promises — tests: `test/features/async.await-runtime.test.js`, `test/features/promise.core-runtime.test.js`

### Test coverage
- [x] Parser coverage for async/await syntax — `test/features/syntax.async-await.parser.test.js`
- [x] Compiler coverage for async metadata + await lowering — `test/features/async.compiler-lowering.test.js`
- [x] Runtime coverage for await ordering, fulfillment, rejection, and suspension/resume — `test/features/async.await-runtime.test.js`, `test/features/promise.core-runtime.test.js`

### Next async steps
- [ ] Async host I/O bridge (trusted host callbacks)
- [ ] Whitelisted async import flow (host-mediated)
- [x] Promise constructor executor support — tests: `test/features/promise.core-runtime.test.js`
- [x] Unhandled rejection policy/reporting — tests: `test/features/promise.unhandled-rejection.test.js`

---

## Bytecode stability (lockstep with implementation)

### Spec documents
- [x] `docs/bytecode/FORMAT.md`
- [x] `docs/bytecode/OPCODES.md`
- [x] `docs/bytecode/VALUES.md`

### Next steps
- [x] Add `bytecodeVersion` to bundle output and verify in VM loader
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
