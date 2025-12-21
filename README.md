# jsvm

A small JavaScript virtual machine intended to safely run a curated subset of JavaScript for untrusted backend template generation and lightweight backend logic.

- Roadmap: `docs/TODO.md`
- Bytecode spec: `docs/bytecode/FORMAT.md`, `docs/bytecode/OPCODES.md`, `docs/bytecode/VALUES.md`

## Development

```zsh
npm test
```

## CLI

Run a snippet from stdin:

```zsh
echo 'print(1+2);' | node bin/jsvm
```

Run from a file:

```zsh
node bin/jsvm --file ./prog.js
```
