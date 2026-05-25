# jsvm

Coordination repository for the split jsvm implementation repos.

This repo keeps submodules plus integration checks that verify the compiler and runtimes stay compatible.

## Managed Submodules

- `external/jsvm-bytecode-definition`
- `external/jsvm-compiler`
- `external/jsvm-vm-js`
- `external/jsvm-c`

Initialize submodules after cloning:

```zsh
git submodule update --init --recursive
```

## Development

Install coordinator test dependencies:

```zsh
npm install
```

Run the cross-runtime parity test:

```zsh
npm run test:e2e
```

This test compiles one JavaScript program to bytecode once, then compares output from:

- Direct Node.js execution
- JavaScript VM runtime (`jsvm-vm-js`)
- C runtime (`jsvm-c`)

## Keep/Remove Plan

See `docs/COORDINATION-KEEP-REMOVE.md` for the safe keep/remove matrix used for cleanup.

## Coordination Workflow

See `docs/COORDINATION-WORKFLOW.md` for the parent-repo workflow and where implementation docs now live.
