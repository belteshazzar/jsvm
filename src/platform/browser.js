// Browser platform adapter for jsvm module loading
// Resolves and loads modules from URLs using fetch()

/**
 * Create a browser-based import resolver using fetch()
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.baseURL - Base URL for resolving relative imports (default: location.href)
 * @param {boolean} options.cache - Enable module caching (default: true)
 * @param {Object} options.globalModules - Pre-loaded modules (useful for mocking)
 * @returns {Object} Resolver with requestImport and utility methods
 */
export function createBrowserImportResolver(options = {}) {
  const {
    baseURL = typeof window !== 'undefined' ? window.location.href : 'http://localhost/',
    cache = true,
    globalModules = {},
  } = options;

  // Module cache: URL -> module exports
  const moduleCache = Object.create(null);

  /**
   * Resolve a module path to an absolute URL
   * Supports:
   * - Relative paths (./, ../)
   * - Absolute URLs (http://, https://)
   * - Root-relative paths (/)
   */
  function resolveModuleURL(modulePath) {
    // If it's an absolute URL, use it as-is
    if (modulePath.startsWith('http://') || modulePath.startsWith('https://')) {
      return modulePath;
    }

    // If it's a root-relative path, resolve from origin
    if (modulePath.startsWith('/')) {
      const baseObj = new URL(baseURL);
      return new URL(modulePath, `${baseObj.protocol}//${baseObj.host}`).href;
    }

    // Relative path - resolve from baseURL
    return new URL(modulePath, baseURL).href;
  }

  /**
   * Ensure URL has .js extension if missing
   */
  function normalizeModuleURL(url) {
    // Don't modify URLs that already have an extension
    if (/\.[a-z]+$/i.test(url)) {
      return url;
    }
    // Add .js if no extension
    return url + '.js';
  }

  // Pre-populate cache with global modules (normalize paths)
  for (const [path, moduleExports] of Object.entries(globalModules)) {
    const normalizedPath = normalizeModuleURL(resolveModuleURL(path));
    moduleCache[normalizedPath] = moduleExports;
  }

  /**
   * Fetch and parse a module from a URL
   * Expects the module to be a JavaScript object literal or JSON
   */
  async function fetchModule(moduleURL) {
    const response = await fetch(moduleURL);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch module: ${response.status} ${response.statusText}`
      );
    }

    const content = await response.text();

    try {
      // Try to evaluate as JavaScript object literal
      // Wrap in parentheses to force expression (not statement)
      const moduleExports = eval(`(${content})`);
      return moduleExports;
    } catch (err) {
      // If that fails, try JSON
      try {
        return JSON.parse(content);
      } catch (jsonErr) {
        throw new Error(
          `Failed to parse module ${moduleURL}: expected JS object or JSON`
        );
      }
    }
  }

  /**
   * Main requestImport implementation
   * @param {string} modulePath - Module path or URL
   * @param {Array} specs - Import specifiers (used for documentation, not filtering)
   * @returns {Promise<Object>} Module exports object
   */
  async function requestImport(modulePath, specs) {
    // Resolve the module path to an absolute URL
    let moduleURL = resolveModuleURL(modulePath);
    moduleURL = normalizeModuleURL(moduleURL);

    // Check cache first
    if (cache && moduleCache[moduleURL]) {
      return Promise.resolve(moduleCache[moduleURL]);
    }

    try {
      // Fetch the module
      const moduleExports = await fetchModule(moduleURL);

      // Cache the result
      if (cache) {
        moduleCache[moduleURL] = moduleExports;
      }

      return moduleExports;
    } catch (err) {
      throw new Error(
        `Failed to import module '${modulePath}': ${err.message}`
      );
    }
  }

  /**
   * Synchronous version if module is already in cache
   * Throws if not cached
   */
  function requestImportSync(modulePath, specs) {
    const moduleURL = normalizeModuleURL(resolveModuleURL(modulePath));

    if (!moduleCache[moduleURL]) {
      throw new Error(
        `Module ${modulePath} not in cache. Use async requestImport or preload modules.`
      );
    }

    return moduleCache[moduleURL];
  }

  /**
   * Pre-load a module by URL
   */
  async function preloadModule(modulePath) {
    return requestImport(modulePath, []);
  }

  /**
   * Clear the module cache
   */
  function clearCache() {
    for (const key of Object.keys(moduleCache)) {
      delete moduleCache[key];
    }
  }

  /**
   * Get the resolved URL for a module path (for debugging)
   */
  function resolveURL(modulePath) {
    return normalizeModuleURL(resolveModuleURL(modulePath));
  }

  return {
    requestImport,
    requestImportSync,
    preloadModule,
    clearCache,
    resolveURL,
    moduleCache,
  };
}

export default createBrowserImportResolver;
