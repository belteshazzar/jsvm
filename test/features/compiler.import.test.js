import { describe, it, expect } from "vitest";
import { default as lex } from "../../src/core/lexer.js";
import { default as parse } from "../../src/core/parser.js";
import { default as compileAst } from "../../src/core/compiler.js";

describe("Compiler: Import Statements", () => {
  function compileCode(src) {
    const tokens = lex(src);
    const ast = parse(tokens);
    return compileAst(ast);
  }

  it("should compile import to bytecode bundle", () => {
    const bundle = compileCode("import { foo } from './module.js';");
    
    expect(bundle).toBeTruthy();
    expect(bundle.bytecodeVersion).toBe(1);
    expect(Array.isArray(bundle.functions)).toBe(true);
    expect(bundle.functions.length).toBeGreaterThan(0);
  });

  it("should include module path in constants", () => {
    const bundle = compileCode("import { foo } from './mymodule.js';");
    
    const hasPath = bundle.consts.some(c => 
      (typeof c === 'string' && c.includes('mymodule')) ||
      (c && c.type === 'str' && c.value && c.value.includes('mymodule'))
    );
    expect(hasPath).toBe(true);
  });

  it("should compile multiple imports", () => {
    const bundle = compileCode(`
      import { a } from './mod1.js';
      import { b } from './mod2.js';
    `);
    
    expect(bundle.functions[0].code.length).toBeGreaterThan(0);
  });

  it("should handle imports with usage in code", () => {
    const bundle = compileCode(`
      import { value } from './module.js';
      const x = value;
      print(x);
    `);
    
    expect(bundle.functions[0].code.length).toBeGreaterThan(0);
    const modulePathInConsts = bundle.consts.some(c => 
      (typeof c === 'string' && c.includes('module.js')) ||
      (c && c.type === 'str' && c.value && c.value.includes('module.js'))
    );
    expect(modulePathInConsts).toBe(true);
  });

  it("should not throw on valid import syntax", () => {
    expect(() => {
      compileCode("import { x, y as z } from './mod.js';");
    }).not.toThrow();
  });
});
