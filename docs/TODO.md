# TODO / Roadmap (Coordinator Repo)

This roadmap tracks cross-repo integration goals for the parent coordination repository.

Implementation ownership:

1. `external/jsvm-bytecode-definition`: bytecode container, opcode docs, value docs, encoder/decoder.
2. `external/jsvm-compiler`: language parsing/lowering to bytecode and compiler CLI.
3. `external/jsvm-vm-js`: JavaScript bytecode runtime.
4. `external/jsvm-c`: C bytecode runtime.

Parent repo ownership:

1. Submodule orchestration.
2. Cross-repo compatibility tests and CI gates.
3. Integration docs and release workflow.

## Current status snapshot

1. [x] Split-repo architecture is in place via submodules under `external/`.
2. [x] Parent-repo parity test compiles once and compares output across Node execution, `jsvm-vm-js`, and `jsvm-c`.
3. [x] Compiler supports import/export metadata in emitted bundles (imports, exports, default export, re-exports).
4. [x] JS runtime supports `IMPORT` opcode and module cache behavior.
5. [x] C runtime supports `IMPORT` opcode and host import callback with cache.
6. [~] Browser-side compile and runtime flow exists at API level but needs coordinator-level packaged examples and CI.
7. [~] Dynamic loading of compiled module bundles is partially implemented through host import callbacks; standardized compiled-module loader contract is still pending.

## Priority goals

1. Compile JavaScript in Node and browser into bytecode bundles.
2. Run those bundles in either runtime (`jsvm-vm-js` or `jsvm-c`) with equivalent behavior.
3. Support module imports/exports end-to-end where modules are loaded in compiled bytecode format.

## Workstream A: Compiled module loading contract

1. [ ] Define a shared compiled-module loader contract for both runtimes.
2. [ ] Specify module identity and cache key rules (absolute URL/path normalization).
3. [ ] Specify import resolution semantics for named/default/re-export cases in compiled bundles.
4. [ ] Define host callback behavior for async/sync loading paths.
5. [ ] Add normative fixtures for multi-module graphs compiled to bytecode.

## Workstream B: Node and browser compilation pipelines

1. [x] Node CLI compile path (`jsc`) emits bytecode bundles.
2. [ ] Browser compile packaging guide for `jsvm-compiler` (ESM/CDN/bundler targets).
3. [ ] Browser example that compiles source to bytecode and executes in JS runtime.
4. [ ] Integration tests for browser compile+run path in CI.

## Workstream C: Cross-runtime parity and compatibility

1. [x] Parent-repo E2E parity test baseline exists.
2. [ ] Expand parity fixtures to include module imports/exports and re-exports using compiled bundles.
3. [ ] Add golden vectors shared across JS and C runtimes (source -> bytecode -> expected output).
4. [ ] Add compatibility matrix document that maps supported feature subsets per runtime.
5. [ ] Gate parent CI on expanded parity suite.

## Workstream D: Bytecode contract hardening

1. [x] Bytecode format/opcode/value docs maintained in `external/jsvm-bytecode-definition/docs/`.
2. [ ] Canonical JSON representation for bytecode debugging and deterministic diffs.
3. [ ] Explicit semantic notes for edge behavior (for example missing property behavior and error format).
4. [ ] Versioning policy for forward/backward compatibility across compiler and runtimes.

## Workstream E: Security and operational limits

1. [ ] Execution budget controls alignment between JS and C runtimes.
2. [ ] Memory and structure size limits policy across runtimes.
3. [ ] Standardized denylist and host API safety requirements for embedding environments.
4. [ ] Deterministic error surface policy for integration tests.

## Coordinator acceptance criteria

1. A module graph can be compiled to bytecode in Node.
2. The same compiled graph can be loaded and run in `jsvm-vm-js` and `jsvm-c` via the shared loader contract.
3. Equivalent program output is verified in coordinator CI against native Node execution where applicable.
4. Browser compile-to-bytecode and run flow is documented and covered by at least one automated integration path.

## Issue tracking

Concrete repository-grouped issues are tracked in `docs/ISSUE-BACKLOG.md`.