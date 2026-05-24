// Node.js platform adapter for jsvm module loading
// Resolves and loads modules from the filesystem using Node.js require()

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);

export function createNodeImportResolver(options = {}) {
  const {
    basePath = process.cwd(),
    extensions = ['.js', '.json'],
    cache = true,
  } = options;

  // Module cache: path -> module exports
  const moduleCache = Object.create(null);

  /**
   * Resolve a module path to an absolute filesystem path
   * Supports:
   * - Relative paths (./, ../)
   * - Absolute paths (/)
   * - Node module paths (node_modules)
   */
  function resolveModulePath(modulePath) {
    // If it's already an absolute path, use it as-is
    if (path.isAbsolute(modulePath)) {
      return modulePath;
    }

    // Relative path - resolve from basePath
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      return path.resolve(basePath, modulePath);
    }

    // Node module path - try node_modules
    try {
      // Use require.resolve to find the module in node_modules
      return require.resolve(modulePath);
    } catch (err) {
      // Not found in node_modules, try relative to basePath
      return path.resolve(basePath, modulePath);
    }
  }

  /**
   * Try to load a file with various extensions
   */
  function findFile(filePath) {
    // If file exists as-is, return it
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    // Try with extensions
    for (const ext of extensions) {
      const pathWithExt = filePath + ext;
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
    }

    // Try as directory with index.js
    const indexPath = path.join(filePath, 'index.js');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }

    return null;
  }

  /**
   * Load a module and return its exports
   */
  function loadModule(resolvedPath) {
    // Try to load with require
    try {
      return require(resolvedPath);
    } catch (err) {
      // If require fails, try to read and parse as JSON
      try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        return JSON.parse(content);
      } catch (jsonErr) {
        throw new Error(
          `Failed to load module at ${resolvedPath}: ${err.message}`
        );
      }
    }
  }

  /**
   * Main requestImport implementation
   * @param {string} modulePath - Module path (relative, absolute, or node module)
   * @param {Array} specs - Import specifiers (not used in Node adapter, can get all exports)
   * @returns {Object} Module exports object
   */
  function requestImport(modulePath, specs) {
    // Check cache first
    if (cache && moduleCache[modulePath]) {
      return moduleCache[modulePath];
    }

    try {
      // Resolve the module path
      const resolvedPath = resolveModulePath(modulePath);

      // Find the actual file (with extension resolution)
      const filePath = findFile(resolvedPath);
      if (!filePath) {
        throw new Error(
          `Module file not found: ${modulePath} (resolved to ${resolvedPath})`
        );
      }

      // Load the module
      const moduleExports = loadModule(filePath);

      // Cache the result
      if (cache) {
        moduleCache[modulePath] = moduleExports;
      }

      return moduleExports;
    } catch (err) {
      throw new Error(
        `Failed to import module '${modulePath}': ${err.message}`
      );
    }
  }

  /**
   * Clear the module cache (useful for testing)
   */
  function clearCache() {
    for (const key of Object.keys(moduleCache)) {
      delete moduleCache[key];
    }
  }

  return {
    requestImport,
    clearCache,
    moduleCache,
  };
}

export default createNodeImportResolver;
