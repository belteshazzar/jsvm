import { describe, it, expect, vi, beforeEach } from "vitest";
import * as jsvm from "../../main.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "../fixtures");

describe("API: Convenience Functions", () => {
  describe("runWithNodeImports()", () => {
    it("should run code with Node.js imports", () => {
      const src = `
        import { test1 } from './test.json';
        print(test1);
      `;

      const output = [];
      jsvm.runWithNodeImports(src, {
        basePath: fixtures,
        onPrint: (s) => output.push(s),
      });

      expect(output).toContain("1");
    });

    it("should respect cache option", () => {
      const src = `
        import { test1 } from './test.json';
        print(test1);
      `;

      const output = [];
      jsvm.runWithNodeImports(src, {
        basePath: fixtures,
        cache: false,
        onPrint: (s) => output.push(s),
      });

      expect(output).toContain("1");
    });
  });

  describe("runWithBrowserImports()", () => {
    it("should accept browser import configuration options", () => {
      // Just verify it accepts the options - full testing is in platform tests
      expect(typeof jsvm.runWithBrowserImports).toBe("function");
      
      // This would need proper async module loading in a browser context
      // Full testing is in test/platform/platform.browser.test.js
    });
  });

  describe("exported utilities", () => {
    it("should export lex function", () => {
      expect(typeof jsvm.lex).toBe("function");
      const tokens = jsvm.lex("1+2");
      expect(Array.isArray(tokens)).toBe(true);
    });

    it("should export parse function", () => {
      expect(typeof jsvm.parse).toBe("function");
      const tokens = jsvm.lex("print(1+2);");
      const ast = jsvm.parse(tokens);
      expect(ast).toBeTruthy();
    });

    it("should export compileAst function", () => {
      expect(typeof jsvm.compileAst).toBe("function");
    });

    it("should export createVM function", () => {
      expect(typeof jsvm.createVM).toBe("function");
    });

    it("should export createDefaultEnv function", () => {
      expect(typeof jsvm.createDefaultEnv).toBe("function");
      const env = jsvm.createDefaultEnv({ onPrint: () => {} });
      expect(env.builtins).toBeTruthy();
    });

    it("should export bytecode I/O functions", () => {
      expect(typeof jsvm.encodeBundle).toBe("function");
      expect(typeof jsvm.decodeBundle).toBe("function");
    });

    it("should export platform adapters", () => {
      expect(typeof jsvm.createNodeImportResolver).toBe("function");
      expect(typeof jsvm.createBrowserImportResolver).toBe("function");
    });

    it("should export metadata", () => {
      expect(jsvm.VERSION).toBe("1.0.0");
      expect(jsvm.BYTECODE_VERSION).toBe(1);
      expect(jsvm.metadata).toBeTruthy();
      expect(jsvm.metadata.name).toBe("jsvm");
    });
  });

  describe("backward compatibility", () => {
    it("should still support run() with onPrint", () => {
      const output = [];
      jsvm.run("print(1+2);", {
        onPrint: (s) => output.push(s),
      });

      expect(output).toContain("3");
    });

    it("should still support compile() and runBundle()", () => {
      const bc = jsvm.compile("print(42);");
      const output = [];
      jsvm.runBundle(bc, {
        onPrint: (s) => output.push(s),
      });

      expect(output).toContain("42");
    });
  });
});
