import { describe, it, expect, vi } from "vitest";
import { createBrowserImportResolver } from "../../main.js";

describe("Platform: Browser Imports", () => {
  it("should create resolver with baseURL", () => {
    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
    });

    expect(resolver).toBeTruthy();
    expect(typeof resolver.requestImport).toBe("function");
    expect(typeof resolver.requestImportSync).toBe("function");
  });

  it("should load preloaded modules synchronously", () => {
    const modules = {
      "./data.json": { value: 42 },
    };

    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
      globalModules: modules,
    });

    const result = resolver.requestImportSync("./data.json", []);
    expect(result.value).toBe(42);
  });

  it("should throw on missing preloaded module", () => {
    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
      globalModules: {},
    });

    expect(() => {
      resolver.requestImportSync("./missing.json", []);
    }).toThrow();
  });

  it("should handle multiple preloaded modules", () => {
    const modules = {
      "./a.json": { id: 1 },
      "./b.json": { id: 2 },
    };

    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
      globalModules: modules,
    });

    const a = resolver.requestImportSync("./a.json", []);
    const b = resolver.requestImportSync("./b.json", []);

    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it("should cache modules by default", () => {
    const modules = {
      "./shared.json": { id: Math.random() },
    };

    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
      globalModules: modules,
    });

    const result1 = resolver.requestImportSync("./shared.json", []);
    const result2 = resolver.requestImportSync("./shared.json", []);

    expect(result1.id).toBe(result2.id);
  });

  it("should resolve URLs correctly", () => {
    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/modules/",
    });

    const resolved = resolver.resolveURL("./utils.json");
    expect(resolved).toContain("example.com");
    expect(resolved).toContain("utils.json");
  });

  it("should handle nested object exports", () => {
    const modules = {
      "./config.json": {
        server: { host: "localhost", port: 3000 },
      },
    };

    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
      globalModules: modules,
    });

    const result = resolver.requestImportSync("./config.json", []);
    expect(result.server.host).toBe("localhost");
  });

  it("should have preloadModule async method", () => {
    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
    });

    expect(typeof resolver.preloadModule).toBe("function");
  });

  it("should export all resolver methods", () => {
    const resolver = createBrowserImportResolver();

    expect(typeof resolver.requestImport).toBe("function");
    expect(typeof resolver.requestImportSync).toBe("function");
    expect(typeof resolver.preloadModule).toBe("function");
    expect(typeof resolver.clearCache).toBe("function");
    expect(typeof resolver.resolveURL).toBe("function");
  });

  it("should handle multiple preloaded datasets", () => {
    const modules = {
      "./users.json": [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
      "./settings.json": { theme: "dark", lang: "en" },
    };

    const resolver = createBrowserImportResolver({
      baseURL: "http://example.com/",
      globalModules: modules,
    });

    const users = resolver.requestImportSync("./users.json", []);
    const settings = resolver.requestImportSync("./settings.json", []);

    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(2);
    expect(settings.theme).toBe("dark");
  });
});
