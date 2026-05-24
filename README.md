# jsvm

A small JavaScript virtual machine intended to safely run a curated subset of JavaScript for untrusted backend template generation and lightweight backend logic.

- Roadmap: `docs/TODO.md`
- Bytecode spec: `docs/bytecode/FORMAT.md`, `docs/bytecode/OPCODES.md`, `docs/bytecode/VALUES.md`

## Development

```zsh
npm test
```

## API

### `createVM(bundle, { env })`

The VM accepts a compiled bytecode bundle and an optional environment object. The environment provides prototypes, builtins (like `print`, `Math`, `JSON`), and number methods.

### Builtins (default environment)

The default environment currently includes:

- `print(value)`
- `console.log/info/warn/error(...)`
- `Math` (curated numeric methods)
- `JSON.parse` / `JSON.stringify`
- `Promise` (core subset)
- `setTimeout(callback, delayMs)`

`setTimeout` behavior in `jsvm`:

- Schedules `callback` to run after `delayMs` (clamped to a non-negative integer).
- Lower delays run before higher delays.
- Returns a numeric timer id.
- `clearTimeout` is not implemented yet.

**With default environment** (standard builtins):

```javascript
import { compile, runBundle } from './main.js';
import { createDefaultEnv } from './src/env.js';

const src = 'print(1 + 2);';
const bundle = compile(src);
const env = createDefaultEnv({ onPrint: console.log });
const vm = createVM(bundle, { env });
vm.runMain(); // prints: 3
```

**With custom/empty environment**:

```javascript
// No builtins: use for sandboxing or custom configurations
const vm = createVM(bundle);  // empty env, no print, no Math, etc.
```

**Or use the convenience API**:

```javascript
import { run } from './main.js';

run('print(42)', { onPrint: console.log }); // prints: 42
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
