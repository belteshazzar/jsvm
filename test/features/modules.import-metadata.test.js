import { describe, it, expect } from "vitest";
import { default as lex } from "../../src/core/lexer.js";
import { default as parse } from "../../src/core/parser.js";
import { default as compile } from "../../src/core/compiler.js";

describe("Module Import Metadata", () => {
  function compileCode(src) {
    const tokens = lex(src);
    const ast = parse(tokens);
    return compile(ast);
  }

  it("should collect single named import in metadata", () => {
    const bundle = compileCode("import { foo } from './module.js';");
    expect(bundle.imports).toHaveLength(1);
    expect(bundle.imports[0].source).toBe("./module.js");
    expect(bundle.imports[0].specifiers).toHaveLength(1);
    expect(bundle.imports[0].specifiers[0].imported).toBe("foo");
    expect(bundle.imports[0].specifiers[0].local).toBe("foo");
  });

  it("should collect aliased imports in metadata", () => {
    const bundle = compileCode("import { foo as bar } from './module.js';");
    expect(bundle.imports).toHaveLength(1);
    const spec = bundle.imports[0].specifiers[0];
    expect(spec.imported).toBe("foo");
    expect(spec.local).toBe("bar");
  });

  it("should collect multiple imports from same module", () => {
    const bundle = compileCode(
      "import { foo, bar, baz } from './module.js';"
    );
    expect(bundle.imports).toHaveLength(1);
    expect(bundle.imports[0].specifiers).toHaveLength(3);
    expect(bundle.imports[0].specifiers[0].imported).toBe("foo");
    expect(bundle.imports[0].specifiers[1].imported).toBe("bar");
    expect(bundle.imports[0].specifiers[2].imported).toBe("baz");
  });

  it("should collect imports from multiple modules", () => {
    const bundle = compileCode(`
      import { x } from './module1.js';
      import { y } from './module2.js';
    `);
    expect(bundle.imports).toHaveLength(2);
    expect(bundle.imports[0].source).toBe("./module1.js");
    expect(bundle.imports[1].source).toBe("./module2.js");
    expect(bundle.imports[0].specifiers[0].imported).toBe("x");
    expect(bundle.imports[1].specifiers[0].imported).toBe("y");
  });

  it("should collect mixed aliased and non-aliased imports", () => {
    const bundle = compileCode(
      "import { foo as f, bar, baz as b } from './module.js';"
    );
    const specs = bundle.imports[0].specifiers;
    expect(specs).toHaveLength(3);
    expect(specs[0]).toEqual({ imported: "foo", local: "f" });
    expect(specs[1]).toEqual({ imported: "bar", local: "bar" });
    expect(specs[2]).toEqual({ imported: "baz", local: "b" });
  });

  it("should handle various module paths", () => {
    const paths = [
      "./relative.js",
      "../parent.js",
      "/absolute.js",
      "package-name",
    ];
    for (const path of paths) {
      const bundle = compileCode(`import { x } from '${path}';`);
      expect(bundle.imports).toHaveLength(1);
      expect(bundle.imports[0].source).toBe(path);
    }
  });

  it("should track imports separately from exports", () => {
    const bundle = compileCode(`
      import { x } from './module.js';
      export { x as z };
    `);
    expect(bundle.imports).toHaveLength(1);
    expect(bundle.imports[0].specifiers[0].imported).toBe("x");
    expect(bundle.exports).toHaveLength(1);
    expect(bundle.exports[0].local).toBe("x");
    expect(bundle.exports[0].exported).toBe("z");
  });

  it("should maintain empty imports array for modules without imports", () => {
    const bundle = compileCode("const x = 1;");
    expect(bundle.imports).toHaveLength(0);
    expect(Array.isArray(bundle.imports)).toBe(true);
  });

  it("should include imports metadata in bundle structure", () => {
    const bundle = compileCode("import { foo } from './m.js';");
    expect(bundle).toHaveProperty("bytecodeVersion");
    expect(bundle).toHaveProperty("functions");
    expect(bundle).toHaveProperty("classes");
    expect(bundle).toHaveProperty("imports");
    expect(bundle).toHaveProperty("exports");
    expect(bundle).toHaveProperty("defaultExport");
    expect(bundle).toHaveProperty("reExports");
  });

  it("should handle complex import scenarios with re-exports", () => {
    const bundle = compileCode(`
      import { a, b as bb } from './m1.js';
      import { c } from './m2.js';
      export { a, bb };
    `);
    expect(bundle.imports).toHaveLength(2);
    expect(bundle.imports[0].specifiers).toHaveLength(2);
    expect(bundle.imports[1].specifiers).toHaveLength(1);
    expect(bundle.exports).toHaveLength(2);
  });
});
