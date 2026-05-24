import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBrowserImportResolver } from '../../src/platform/browser.js';

// Mock fetch for testing
global.fetch = vi.fn();

beforeEach(() => {
  fetch.mockClear();
});

test('platform/browser: loads module from URL', async () => {
  const moduleContent = `({
    greeting: 'Hello from Browser',
    value: 123
  })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/'
  });

  const result = await resolver.requestImport('modules/data', []);

  expect(result.greeting).toBe('Hello from Browser');
  expect(result.value).toBe(123);
  expect(fetch).toHaveBeenCalledWith('http://localhost/modules/data.js');
});

test('platform/browser: resolves relative URLs', async () => {
  const moduleContent = `({ relative: true })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/app/'
  });

  const result = await resolver.requestImport('./utils', []);

  expect(result.relative).toBe(true);
  expect(fetch).toHaveBeenCalledWith('http://localhost/app/utils.js');
});

test('platform/browser: resolves absolute URLs', async () => {
  const moduleContent = `({ absolute: true })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/app/'
  });

  const result = await resolver.requestImport('http://api.example.com/modules/config', []);

  expect(result.absolute).toBe(true);
  expect(fetch).toHaveBeenCalledWith('http://api.example.com/modules/config.js');
});

test('platform/browser: resolves root-relative paths', async () => {
  const moduleContent = `({ rootRelative: true })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost:3000/deep/path/'
  });

  const result = await resolver.requestImport('/api/config', []);

  expect(result.rootRelative).toBe(true);
  expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/config.js');
});

test('platform/browser: caches modules', async () => {
  const moduleContent = `({ cached: true })`;

  fetch.mockClear();
  fetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/',
    cache: true
  });

  // Load the same module twice
  const result1 = await resolver.requestImport('config', []);
  const result2 = await resolver.requestImport('config', []);

  // Should be the same object (from cache)
  expect(result1).toBe(result2);

  // fetch should only be called once (second time from cache)
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('platform/browser: respects cache: false', async () => {
  const moduleContent = `({ test: true })`;

  fetch.mockClear();
  fetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/',
    cache: false
  });

  await resolver.requestImport('config', []);
  await resolver.requestImport('config', []);

  // fetch should be called twice since cache is disabled
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('platform/browser: parses JSON modules', async () => {
  const jsonContent = JSON.stringify({
    name: 'test',
    version: '1.0.0'
  });

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => jsonContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/'
  });

  const result = await resolver.requestImport('package.json', []);

  expect(result.name).toBe('test');
  expect(result.version).toBe('1.0.0');
});

test('platform/browser: throws error on fetch failure', async () => {
  fetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
    statusText: 'Not Found'
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/'
  });

  await expect(
    resolver.requestImport('missing', [])
  ).rejects.toThrow('Failed to fetch module');
});

test('platform/browser: clearCache() empties the cache', async () => {
  const moduleContent = `({ data: 'test' })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/',
    cache: true
  });

  await resolver.requestImport('config', []);
  expect(Object.keys(resolver.moduleCache).length).toBeGreaterThan(0);

  resolver.clearCache();
  expect(Object.keys(resolver.moduleCache).length).toBe(0);
});

test('platform/browser: uses globalModules for pre-loaded modules', async () => {
  fetch.mockClear();

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/',
    globalModules: {
      'http://localhost/pre.js': { preLoaded: true }
    }
  });

  // Should use globalModules without fetching
  const result = await resolver.requestImport('pre', []);
  expect(result.preLoaded).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});

test('platform/browser: requestImportSync works for cached modules', async () => {
  const moduleContent = `({ cached: true })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/'
  });

  // Load async first
  await resolver.requestImport('config', []);

  // Then use sync version
  const result = resolver.requestImportSync('config', []);
  expect(result.cached).toBe(true);
});

test('platform/browser: requestImportSync throws if not cached', () => {
  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/'
  });

  expect(() => {
    resolver.requestImportSync('uncached', []);
  }).toThrow('not in cache');
});

test('platform/browser: resolveURL returns normalized URL', () => {
  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/app/'
  });

  const url = resolver.resolveURL('./module');
  expect(url).toBe('http://localhost/app/module.js');
});

test('platform/browser: handles modules with existing extensions', async () => {
  const moduleContent = `({ hasExt: true })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/'
  });

  const result = await resolver.requestImport('config.json', []);

  expect(result.hasExt).toBe(true);
  // URL should not have .js appended to .json
  expect(fetch).toHaveBeenCalledWith('http://localhost/config.json');
});

test('platform/browser: preloadModule() pre-fetches a module', async () => {
  const moduleContent = `({ preLoaded: true })`;

  fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => moduleContent
  });

  const resolver = createBrowserImportResolver({
    baseURL: 'http://localhost/'
  });

  await resolver.preloadModule('config');

  // Module should now be in cache
  expect(Object.keys(resolver.moduleCache).length).toBeGreaterThan(0);
});
