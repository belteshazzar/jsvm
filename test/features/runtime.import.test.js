import { describe, it, expect } from "vitest";
import { run } from "../../main.js";

describe("Runtime: Import Execution", () => {
  it("should execute code with imports", () => {
    const src = `
      import { value } from './test';
      print(value);
    `;

    const modules = { "./test": { value: 42 } };
    const output = [];

    run(src, {
      onPrint: (s) => output.push(s),
      requestImport: (path) => modules[path],
    });

    expect(output).toContain("42");
  });

  it("should extract multiple specifiers from module", () => {
    const src = `
      import { x, y, z } from './mod';
      print(x + y + z);
    `;

    const modules = { "./mod": { x: 10, y: 20, z: 30 } };
    const output = [];

    run(src, {
      onPrint: (s) => output.push(s),
      requestImport: (path) => modules[path],
    });

    expect(output).toContain("60");
  });

  it("should support aliased imports", () => {
    const src = `
      import { foo as bar } from './mod';
      print(bar);
    `;

    const modules = { "./mod": { foo: "hello" } };
    const output = [];

    run(src, {
      onPrint: (s) => output.push(s),
      requestImport: (path) => modules[path],
    });

    expect(output).toContain("hello");
  });

  it("should cache loaded modules", () => {
    const src = `
      import { count } from './counter';
      import { count as count2 } from './counter';
      print(count === count2);
    `;

    const modules = { "./counter": { count: 42 } };
    let callCount = 0;
    const output = [];

    run(src, {
      onPrint: (s) => output.push(s),
      requestImport: (path) => {
        callCount++;
        return modules[path];
      },
    });

    expect(callCount).toBe(1); // Should only load once due to caching
    expect(output).toContain("true");
  });

  it("should use imported values in expressions", () => {
    const src = `
      import { value, multiplier } from './math';
      const result = value * multiplier;
      print(result);
    `;

    const modules = { "./math": { value: 5, multiplier: 2 } };
    const output = [];

    run(src, {
      onPrint: (s) => output.push(s),
      requestImport: (path) => modules[path],
    });

    expect(output).toContain("10");
  });

  it("should throw if requestImport is missing", () => {
    const src = `import { x } from './mod'; print(x);`;
    
    expect(() => {
      run(src, { onPrint: () => {} });
    }).toThrow();
  });

  it("should work with object destructuring from modules", () => {
    const src = `
      import { config } from './settings';
      print(config.apiUrl);
    `;

    const modules = {
      "./settings": { config: { apiUrl: "http://api.example.com" } }
    };
    const output = [];

    run(src, {
      onPrint: (s) => output.push(s),
      requestImport: (path) => modules[path],
    });

    expect(output).toContain("http://api.example.com");
  });
});
