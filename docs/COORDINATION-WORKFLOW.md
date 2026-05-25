# Coordination Workflow

This repository coordinates multiple implementation repositories via Git submodules and an end-to-end parity test.

## Authoritative Repositories

The implementation source of truth lives under `external/`:

- `external/jsvm-bytecode-definition`
- `external/jsvm-compiler`
- `external/jsvm-vm-js`
- `external/jsvm-c`

Do not add duplicate runtime/compiler/bytecode implementation docs or examples to this parent repository.

## Local Setup

1. Initialize submodules:

```zsh
git submodule update --init --recursive
```

2. Install coordinator dependencies:

```zsh
npm install
```

3. Run cross-runtime parity:

```zsh
npm run test:e2e
```

## Where to Add New Docs

1. Compiler behavior and compiler CLI docs: `external/jsvm-compiler`
2. Bytecode format/opcodes/value semantics: `external/jsvm-bytecode-definition`
3. JavaScript runtime docs: `external/jsvm-vm-js`
4. C runtime docs: `external/jsvm-c`
5. Cross-repo integration policy and CI in this parent repo: `docs/`