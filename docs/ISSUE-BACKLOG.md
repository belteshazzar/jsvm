# Issue Backlog by Repository

This document turns the coordinator roadmap into concrete, trackable issues grouped by repository.

Status legend:

- `todo`: not started
- `in-progress`: active work
- `blocked`: waiting on dependency
- `done`: completed

## external/jsvm-bytecode-definition

### BD-01: Define compiled-module loader contract schema
- Status: `todo`
- Goal: Define a normative data contract for loading compiled module bundles across runtimes.
- Scope:
  - Document loader request/response shape.
  - Define required fields for module identity, exports map, and errors.
  - Define sync/async variants.
- Acceptance criteria:
  - Contract is documented in repo docs.
  - JS and C runtime teams can implement against the same spec without ambiguity.

### BD-02: Canonical bytecode JSON form for deterministic diffs
- Status: `todo`
- Goal: Add canonical JSON representation for bytecode inspection and fixture versioning.
- Scope:
  - Define ordering/stability rules.
  - Add encode/decode helpers for canonical JSON.
- Acceptance criteria:
  - Same input bundle always produces byte-identical canonical JSON output.

### BD-03: Versioning policy across compiler and runtimes
- Status: `todo`
- Goal: Define forward/backward compatibility policy for bytecode and container versions.
- Scope:
  - Semver/compatibility matrix.
  - Required failure behavior on version mismatch.
- Acceptance criteria:
  - Policy documented and referenced by compiler and runtime repos.

### BD-04: Module semantics clarifications
- Status: `todo`
- Goal: Remove cross-runtime ambiguity in module semantics.
- Scope:
  - Missing export behavior.
  - Re-export conflict behavior.
  - Error shapes for unresolved imports.
- Acceptance criteria:
  - Semantics documented with executable examples.

## external/jsvm-compiler

### CP-01: Browser compile packaging guide and verified example
- Status: `todo`
- Goal: Make browser-side compile path first-class.
- Scope:
  - Add browser usage guidance (bundler/CDN).
  - Provide working compile-to-bytecode browser example.
- Acceptance criteria:
  - Example compiles JS source to valid bundle in browser runtime.

### CP-02: Compiled module graph fixtures (import/export/re-export)
- Status: `todo`
- Goal: Provide canonical module graph sources for parity tests.
- Scope:
  - Add fixtures with named/default/re-export combinations.
  - Emit bundle set for coordinator integration tests.
- Acceptance criteria:
  - Fixtures compile successfully and are consumed by coordinator tests.

### CP-03: Dynamic compiled import metadata completeness
- Status: `todo`
- Goal: Ensure compiled metadata fully supports dynamic compiled-module loading.
- Scope:
  - Verify metadata includes what runtime loaders need for graph resolution.
  - Add tests for metadata invariants.
- Acceptance criteria:
  - Tests assert imports/exports/default/reExports metadata consistency for module graphs.

### CP-04: Node+browser API parity for compilation
- Status: `todo`
- Goal: Align compile API ergonomics between Node and browser usage.
- Scope:
  - Document and test consistent compile entrypoints and outputs.
- Acceptance criteria:
  - Same source yields equivalent bundle in Node and browser compile paths.

## external/jsvm-vm-js

### VMJS-01: Implement shared compiled-module loader contract
- Status: `todo`
- Goal: Conform JS runtime module loading to the shared bytecode-definition contract.
- Scope:
  - Implement/adjust requestImport integration.
  - Align cache key normalization and error behavior.
- Acceptance criteria:
  - Coordinator module-graph tests pass using compiled bundles.

### VMJS-02: Browser runtime integration for compiled bundles
- Status: `todo`
- Goal: Support browser-hosted compiled bundle loading and execution.
- Scope:
  - Host adapter for URL-based bundle loading.
  - Cache and resolver semantics in browser context.
- Acceptance criteria:
  - Browser integration test executes compiled module graph successfully.

### VMJS-03: Runtime error surface normalization
- Status: `todo`
- Goal: Stabilize runtime error format for cross-runtime parity assertions.
- Scope:
  - Error category and message policy.
  - Include consistent location/opcode context where available.
- Acceptance criteria:
  - Error snapshots are stable across test runs.

### VMJS-04: Security/runtime budget controls
- Status: `todo`
- Goal: Provide enforceable execution safety limits.
- Scope:
  - Step/time budget controls.
  - Configurable limits exposed to host.
- Acceptance criteria:
  - Limit breaches fail deterministically with documented error format.

## external/jsvm-c

### VMC-01: Implement shared compiled-module loader contract
- Status: `todo`
- Goal: Match C runtime import/loading behavior to shared contract.
- Scope:
  - Align callback API and cache semantics.
  - Match module identity normalization behavior.
- Acceptance criteria:
  - Coordinator module-graph tests pass for C runtime.

### VMC-02: Complete host object to boxed value conversion path
- Status: `todo`
- Goal: Ensure imports from host side are converted safely and consistently.
- Scope:
  - Normalize conversion behavior to JS runtime semantics.
  - Add tests for arrays/objects/primitives.
- Acceptance criteria:
  - Imported host objects behave consistently between JS and C runtimes.

### VMC-03: Runtime compatibility matrix publication
- Status: `todo`
- Goal: Explicitly document supported feature subset and known gaps.
- Scope:
  - Publish machine-readable or markdown compatibility table.
  - Link checklist items to concrete test artifacts.
- Acceptance criteria:
  - Matrix is current and referenced by coordinator repo.

### VMC-04: Deterministic resource and error policy
- Status: `todo`
- Goal: Align failure behavior with coordinator parity expectations.
- Scope:
  - Deterministic error categories for unsupported features and limits.
  - Runtime budget/memory policy alignment.
- Acceptance criteria:
  - Coordinator negative-path tests can assert deterministic failures.

## parent repo (jsvm) - CI/integration

### COORD-01: Expand parity suite to compiled module graphs
- Status: `todo`
- Goal: Validate module import/export behavior with compiled bundles across runtimes.
- Scope:
  - Add coordinator tests for named/default/re-export module graphs.
  - Compare outputs across Node direct, JS VM, and C VM.
- Acceptance criteria:
  - New parity tests pass in CI for all supported graph fixtures.

### COORD-02: Browser compile-and-run integration gate
- Status: `todo`
- Goal: Add at least one automated browser path in CI.
- Scope:
  - Headless browser integration test that compiles and runs bundle.
  - Include module graph case.
- Acceptance criteria:
  - CI job enforces browser integration path.

### COORD-03: Shared golden vectors pipeline
- Status: `todo`
- Goal: Establish reusable source->bundle->output fixtures consumed by all repos.
- Scope:
  - Add fixture format and sync process.
  - Validate vectors in coordinator CI.
- Acceptance criteria:
  - All runtimes can run and verify same vector set.

### COORD-04: Cross-repo release compatibility check
- Status: `todo`
- Goal: Prevent incompatible releases across compiler/bytecode/runtimes.
- Scope:
  - Add compatibility matrix check in CI.
  - Fail if submodule combination violates stated version policy.
- Acceptance criteria:
  - CI reports clear pass/fail with actionable mismatch diagnostics.

### COORD-05: Integration issue triage and ownership policy
- Status: `todo`
- Goal: Keep roadmap and issue ownership synchronized across repos.
- Scope:
  - Define owner labels and escalation path.
  - Add cadence for roadmap/status review.
- Acceptance criteria:
  - Each issue references owning repo and dependency issues.
