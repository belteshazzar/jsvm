# jsvm-vm-js

JavaScript implementation of the jsvm runtime.

Public API:
- `createVM(bundle, options)`
- `createDefaultEnv(options)`

This VM executes bundles produced by a compatible compiler and can be swapped with other runtimes (for example, a C runtime) that implement the same bytecode contract.
