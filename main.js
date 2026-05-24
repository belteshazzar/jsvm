
import lex from "./src/core/lexer.js";
import parse from "./src/core/parser.js";
import compileAst from "./src/core/compiler.js";
import createVM from "./src/core/vm.js";
import { decodeBundle, encodeBundle } from "./src/bytecode/io.js";
import { createDefaultEnv } from "./src/core/env.js";

// Platform adapters for module loading
import { default as createNodeImportResolver } from "./src/platform/node.js";
import { default as createBrowserImportResolver } from "./src/platform/browser.js";

export function compile(src) {
  const toks = lex(src);
  const ast = parse(toks);
  return compileAst(ast);
}

export function runBundle(bundleOrJson, options = {}) {
  const {
    onPrint = s => {},
    requestImport = undefined,
  } = options;
  
  const bundle =
    typeof bundleOrJson === 'string' ? JSON.parse(bundleOrJson) : bundleOrJson;
  const env = createDefaultEnv({ onPrint });
  
  // Add requestImport callback if provided
  if (typeof requestImport === 'function') {
    env.requestImport = requestImport;
  }
  
  const vm = createVM(bundle, { env });
  return vm.runMain();
}

export function compileBinary(src) {
  const bundle = compile(src);
  return encodeBundle(bundle);
}

export function runBundleBuffer(buf, options = {}) {
  const bundle = decodeBundle(buf);
  return runBundle(bundle, options);
}

export function run(src, options = {}) {
  const {
    onPrint = s => {},
    requestImport = undefined,
  } = options;
  
  const bc = compile(src);
  return runBundle(bc, { onPrint, requestImport });
}

// ---- Platform-specific convenience functions ----

/**
 * Run jsvm code with Node.js module imports
 * @param {string} src - Source code with import statements
 * @param {Object} options - Configuration options
 * @param {string} options.basePath - Base directory for module resolution
 * @param {string[]} options.extensions - File extensions to try
 * @param {Function} options.onPrint - Print callback
 * @param {boolean} options.cache - Enable module caching
 * @returns {*} Result of running the code
 */
export function runWithNodeImports(src, options = {}) {
  const {
    basePath = undefined,
    extensions = undefined,
    onPrint = s => {},
    cache = true,
  } = options;

  const resolver = createNodeImportResolver({
    basePath,
    extensions,
    cache,
  });

  return run(src, {
    onPrint,
    requestImport: resolver.requestImport,
  });
}

/**
 * Run jsvm code with browser module imports (via Fetch)
 * @param {string} src - Source code with import statements
 * @param {Object} options - Configuration options
 * @param {string} options.baseURL - Base URL for module resolution
 * @param {Object} options.globalModules - Pre-loaded modules
 * @param {Function} options.onPrint - Print callback
 * @param {boolean} options.cache - Enable module caching
 * @returns {*} Result of running the code (or Promise if using async imports)
 */
export function runWithBrowserImports(src, options = {}) {
  const {
    baseURL = undefined,
    globalModules = undefined,
    onPrint = s => {},
    cache = true,
  } = options;

  const resolver = createBrowserImportResolver({
    baseURL,
    globalModules,
    cache,
  });

  return run(src, {
    onPrint,
    requestImport: (path, specs) => {
      return resolver.requestImportSync(path, specs);
    },
  });
}

// ---- Advanced utilities (for custom use cases) ----

// Lexer: Tokenize source code
export { default as lex } from "./src/core/lexer.js";

// Parser: Parse tokens into AST
export { default as parse } from "./src/core/parser.js";

// Compiler: Lower AST to bytecode
export { default as compileAst } from "./src/core/compiler.js";

// VM: Create and run a VM
export { default as createVM } from "./src/core/vm.js";

// Environment: Create default VM environment
export { createDefaultEnv } from "./src/core/env.js";

// Bytecode I/O: Encode/decode bundles
export { encodeBundle, decodeBundle } from "./src/bytecode/io.js";

// ---- Platform adapters ----

// Node.js filesystem-based module resolver
export { default as createNodeImportResolver } from "./src/platform/node.js";

// Browser Fetch-based module resolver
export { default as createBrowserImportResolver } from "./src/platform/browser.js";

// ---- Package metadata ----

export const VERSION = "1.0.0";
export const BYTECODE_VERSION = 1;

// Version metadata
export const metadata = {
  name: "jsvm",
  version: VERSION,
  bytecodeVersion: BYTECODE_VERSION,
  description: "A safe JavaScript subset VM with module support",
};