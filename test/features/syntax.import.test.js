import { describe, it, expect } from "vitest";
import { default as lex } from "../../src/core/lexer.js";
import { default as parse } from "../../src/core/parser.js";

describe("Syntax: Import Declarations", () => {
  function parseCode(src) {
    const tokens = lex(src);
    return parse(tokens);
  }

  it("should parse named import", () => {
    const ast = parseCode("import { foo } from './module.js';");
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0].type).toBe("ImportDeclaration");
    expect(ast.body[0].source).toBe("./module.js");
  });

  it("should parse multiple named imports", () => {
    const ast = parseCode("import { foo, bar, baz } from './module.js';");
    const imp = ast.body[0];
    expect(imp.specifiers).toHaveLength(3);
    expect(imp.specifiers[0].imported).toBe("foo");
    expect(imp.specifiers[1].imported).toBe("bar");
    expect(imp.specifiers[2].imported).toBe("baz");
  });

  it("should parse aliased imports", () => {
    const ast = parseCode("import { foo as bar } from './module.js';");
    const imp = ast.body[0];
    expect(imp.specifiers[0].imported).toBe("foo");
    expect(imp.specifiers[0].local).toBe("bar");
  });

  it("should handle various module paths", () => {
    expect(() => parseCode("import { x } from './relative.js';")).not.toThrow();
    expect(() => parseCode("import { x } from '../parent.js';")).not.toThrow();
    expect(() => parseCode("import { x } from '/absolute.js';")).not.toThrow();
    expect(() => parseCode("import { x } from 'package-name';")).not.toThrow();
  });

  it("should allow imports to be used in code", () => {
    const ast = parseCode(`
      import { value } from './module.js';
      const x = value;
    `);
    expect(ast.body.length).toBeGreaterThan(1);
    expect(ast.body[0].type).toBe("ImportDeclaration");
    expect(ast.body[1].type).toBe("ConstDecl");
  });

  it("should error on missing 'from' keyword", () => {
    expect(() => parseCode("import { foo };")).toThrow();
  });

  it("should error on invalid syntax", () => {
    expect(() => parseCode("import foo from './module.js';")).toThrow();
  });
});
