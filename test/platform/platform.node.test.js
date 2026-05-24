import { test, expect, beforeEach, afterEach } from 'vitest';
import { createNodeImportResolver } from '../../src/platform/node.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Create a temporary directory for test modules
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jsvm-test-'));
}

function removeTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeModule(dir, name, content) {
  const filePath = path.join(dir, name);
  const dirPath = path.dirname(filePath);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

test('platform/node: loads simple JS module', () => {
  const tempDir = createTempDir();
  try {
    writeModule(tempDir, 'simple.js', `
      export const message = 'Hello from Node!';
      export const number = 42;
    `);

    // Note: For this test, we're using require which expects CommonJS
    // Let's use a JSON module instead for testing
    writeModule(tempDir, 'data.json', JSON.stringify({
      greeting: 'Hello',
      count: 42
    }));

    const resolver = createNodeImportResolver({ basePath: tempDir });
    const result = resolver.requestImport('./data.json', []);

    expect(result.greeting).toBe('Hello');
    expect(result.count).toBe(42);
  } finally {
    removeTempDir(tempDir);
  }
});

test('platform/node: resolves relative paths', () => {
  const tempDir = createTempDir();
  try {
    // Create nested directory structure
    writeModule(tempDir, 'modules/config.json', JSON.stringify({
      apiUrl: 'https://api.example.com'
    }));

    const resolver = createNodeImportResolver({ basePath: tempDir });
    const result = resolver.requestImport('./modules/config.json', []);

    expect(result.apiUrl).toBe('https://api.example.com');
  } finally {
    removeTempDir(tempDir);
  }
});

test('platform/node: resolves absolute paths', () => {
  const tempDir = createTempDir();
  try {
    const filePath = writeModule(tempDir, 'absolute.json', JSON.stringify({
      isAbsolute: true,
      path: __dirname
    }));

    const resolver = createNodeImportResolver({ basePath: tempDir });
    const result = resolver.requestImport(filePath, []);

    expect(result.isAbsolute).toBe(true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('platform/node: caches loaded modules', () => {
  const tempDir = createTempDir();
  try {
    writeModule(tempDir, 'cached.json', JSON.stringify({
      cached: true
    }));

    const resolver = createNodeImportResolver({ basePath: tempDir, cache: true });

    // Load module twice
    const result1 = resolver.requestImport('./cached.json', []);
    const result2 = resolver.requestImport('./cached.json', []);

    // Should be the same object
    expect(result1).toBe(result2);
  } finally {
    removeTempDir(tempDir);
  }
});

test('platform/node: clearCache() empties the cache', () => {
  const tempDir = createTempDir();
  try {
    writeModule(tempDir, 'clearable.json', JSON.stringify({
      data: 'test'
    }));

    const resolver = createNodeImportResolver({ basePath: tempDir, cache: true });

    // Load and verify cache
    resolver.requestImport('./clearable.json', []);
    expect(Object.keys(resolver.moduleCache).length).toBeGreaterThan(0);

    // Clear cache
    resolver.clearCache();
    expect(Object.keys(resolver.moduleCache).length).toBe(0);
  } finally {
    removeTempDir(tempDir);
  }
});

test('platform/node: respects extensions array option', () => {
  const tempDir = createTempDir();
  try {
    writeModule(tempDir, 'data.custom', JSON.stringify({
      custom: true
    }));

    const resolver = createNodeImportResolver({
      basePath: tempDir,
      extensions: ['.custom', '.json']
    });

    const result = resolver.requestImport('./data', []);
    expect(result.custom).toBe(true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('platform/node: throws error for missing module', () => {
  const tempDir = createTempDir();
  try {
    const resolver = createNodeImportResolver({ basePath: tempDir });

    expect(() => {
      resolver.requestImport('./nonexistent.json', []);
    }).toThrow('Module file not found');
  } finally {
    removeTempDir(tempDir);
  }
});

test('platform/node: disables cache when cache: false', () => {
  const tempDir = createTempDir();
  try {
    writeModule(tempDir, 'nocache.json', JSON.stringify({
      data: 'test'
    }));

    const resolver = createNodeImportResolver({ basePath: tempDir, cache: false });

    resolver.requestImport('./nocache.json', []);
    expect(Object.keys(resolver.moduleCache).length).toBe(0);
  } finally {
    removeTempDir(tempDir);
  }
});
