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

## Updating Submodules and Publishing Changes

Use this flow when you need to pull the latest submodule commits or when you made changes inside a submodule and want to publish them correctly.

### A) Update all submodules to latest remote commits

From the parent repository root:

```zsh
git submodule update --init --recursive
git submodule foreach 'git checkout main && git pull --ff-only origin main'
```

If submodule pointers changed after this, commit them in the parent repo:

```zsh
git add external
git commit -m "chore: bump submodule pointers"
git push origin main
```

### B) You changed code inside one submodule

Example shown with `external/jsvm-compiler` (same pattern for any submodule).

1. Commit and push in the submodule itself:

```zsh
cd external/jsvm-compiler
git status
git add .
git commit -m "feat: describe your change"
git push origin main
cd ../..
```

2. Record the new submodule commit in the parent coordinator repo:

```zsh
git status
git add external/jsvm-compiler
git commit -m "chore: update jsvm-compiler submodule"
git push origin main
```

3. Verify everything is aligned:

```zsh
git submodule status
npm run test:e2e
```

Important: pushing only inside the submodule is not enough. The parent repository must also commit the updated submodule pointer, or other developers/CI will keep using the old submodule commit.

## Canonical Host-Callback Examples

Use these coordination tests as the canonical end-to-end examples of VM-to-host callback wiring:

1. Sync callback roundtrip: `test/native.callbacks.roundtrip.test.js` (`hostAdd`)
2. Async callback roundtrip with `await`: `test/native.callbacks.roundtrip.test.js` (`hostDelayDouble`)

Both compile source via the external compiler, roundtrip through bytecode encode/decode, execute in the JS VM, and assert values crossing the VM/host boundary.

## Where to Add New Docs

1. Compiler behavior and compiler CLI docs: `external/jsvm-compiler`
2. Bytecode format/opcodes/value semantics: `external/jsvm-bytecode-definition`
3. JavaScript runtime docs: `external/jsvm-vm-js`
4. C runtime docs: `external/jsvm-c`
5. Cross-repo integration policy and CI in this parent repo: `docs/`