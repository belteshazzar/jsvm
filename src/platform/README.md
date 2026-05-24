# Platform Adapters

This directory contains platform-specific module resolution adapters for jsvm. These adapters implement the `requestImport` callback contract, enabling module loading in different environments.

## Node.js Adapter (`node.js`)

The Node.js adapter resolves and loads modules from the filesystem using Node.js APIs.

### Features
- Resolves relative paths (`./ ../`)
- Resolves absolute paths
- Resolves node_modules imports
- Automatic file extension resolution (`.js`, `.json`)
- Directory resolution with `index.js`
- Per-VM-instance module caching
- Configurable base path and extensions

### Usage

```javascript
import { createNodeImportResolver } from './src/platform/node.js';
import { run } from './main.js';

// Create a resolver
const resolver = createNodeImportResolver({
  basePath: process.cwd(),        // Base directory for relative imports
  extensions: ['.js', '.json'],   // File extensions to try
  cache: true                      // Enable module caching
});

// Run code with imports
const code = `
  import { greet } from './modules/greeting';
  print(greet('World'));
`;

const result = run(code, {
  requestImport: resolver.requestImport
});
```

### Module Format

Modules should export a plain JavaScript object:

```javascript
// greeting.js (as CommonJS)
module.exports = {
  greet: (name) => `Hello, ${name}!`
};

// Or as JSON
// greeting.json
{
  "greet": "Hello from file!"
}
```

### API

#### `createNodeImportResolver(options)`

Creates a Node.js-based import resolver.

**Options:**
- `basePath` (string): Base directory for resolving relative imports. Defaults to `process.cwd()`.
- `extensions` (string[]): File extensions to try when resolving modules. Defaults to `['.js', '.json']`.
- `cache` (boolean): Whether to cache loaded modules. Defaults to `true`.

**Returns:** Object with methods:
- `requestImport(modulePath, specs)` - Load a module
- `clearCache()` - Clear the module cache
- `moduleCache` - Access the cache directly

---

## Browser Adapter (`browser.js`)

The browser adapter loads modules from URLs using the Fetch API.

### Features
- Resolves relative URLs
- Resolves absolute URLs
- Resolves root-relative paths
- Automatic `.js` extension when needed
- Parse JavaScript objects and JSON
- Per-resolver module caching
- Pre-loaded modules support
- Synchronous access for cached modules

### Usage

```javascript
import { createBrowserImportResolver } from './src/platform/browser.js';
import { run } from './main.js';

// Create a resolver
const resolver = createBrowserImportResolver({
  baseURL: 'http://localhost:3000/app/',  // Base URL for relative imports
  cache: true,                             // Enable module caching
  globalModules: {}                        // Pre-loaded modules
});

// Run code with imports
const code = `
  import { config } from './config';
  print(config.apiUrl);
`;

const result = run(code, {
  requestImport: resolver.requestImport
});
```

### Module Format

Modules can be either JavaScript object literals or JSON:

```javascript
// config.json
{
  "apiUrl": "https://api.example.com",
  "timeout": 5000
}

// Or served as JavaScript with object literal export
// modules/settings.js response body:
({
  theme: 'dark',
  language: 'en'
})
```

### API

#### `createBrowserImportResolver(options)`

Creates a browser-based import resolver using Fetch.

**Options:**
- `baseURL` (string): Base URL for resolving relative imports. Defaults to `window.location.href`.
- `cache` (boolean): Whether to cache loaded modules. Defaults to `true`.
- `globalModules` (object): Pre-loaded modules as a map of URL -> exports. Defaults to `{}`.

**Returns:** Object with methods:
- `requestImport(modulePath, specs)` - Asynchronously load a module (returns Promise)
- `requestImportSync(modulePath, specs)` - Synchronously access a cached module (throws if not cached)
- `preloadModule(modulePath)` - Pre-fetch and cache a module
- `clearCache()` - Clear the module cache
- `resolveURL(modulePath)` - Get the resolved URL for a module path (for debugging)
- `moduleCache` - Access the cache directly

### Handling Asynchronous Imports

The browser adapter's `requestImport` returns a Promise. To use it with jsvm, you might want to pre-load modules:

```javascript
const resolver = createBrowserImportResolver();

// Pre-load modules before running code
await Promise.all([
  resolver.preloadModule('/api/config'),
  resolver.preloadModule('/api/user')
]);

// Now run code synchronously
const result = run(code, {
  requestImport: (path, specs) => {
    // Use sync version since modules are pre-loaded
    return resolver.requestImportSync(path, specs);
  }
});
```

Or use pre-loaded modules:

```javascript
const resolver = createBrowserImportResolver({
  globalModules: {
    'http://localhost:3000/config.js': {
      apiUrl: 'https://api.example.com'
    }
  }
});

// Module will be available immediately without fetching
const result = run(code, {
  requestImport: (path, specs) => {
    return resolver.requestImportSync(path, specs);
  }
});
```

---

## Custom Adapters

You can create custom platform adapters by implementing the `requestImport` callback:

```javascript
function createCustomResolver() {
  return {
    requestImport: (modulePath, specs) => {
      // Your custom module loading logic here
      // Must return an object with the exported values
      
      if (modulePath === 'special') {
        return {
          value: 42,
          greet: (name) => `Hello, ${name}!`
        };
      }
      
      throw new Error(`Module not found: ${modulePath}`);
    }
  };
}

// Use with jsvm
const result = run(code, {
  requestImport: createCustomResolver().requestImport
});
```

---

## Module Caching

Both adapters support module caching to prevent duplicate loads and maintain module identity:

```javascript
const resolver = createNodeImportResolver();

// First load
const mod1 = resolver.requestImport('./module');

// Second load - from cache
const mod2 = resolver.requestImport('./module');

// Same object (reference equality)
console.log(mod1 === mod2); // true

// Clear cache if needed
resolver.clearCache();
```

---

## Error Handling

Both adapters throw descriptive errors when modules cannot be loaded:

```javascript
try {
  resolver.requestImport('./nonexistent');
} catch (err) {
  console.error(err.message);
  // "Module file not found: ./nonexistent (resolved to /full/path)"
}
```
