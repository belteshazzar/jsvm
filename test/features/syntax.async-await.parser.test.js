import { test, expect } from 'vitest';
import lex from '../../src/lexer.js';
import parse from '../../src/parser.js';

test('lexer recognizes async/await keywords', () => {
  const toks = lex('async function f(){ return await x; }');
  expect(toks.some(t => t.type === 'ASYNC')).toBe(true);
  expect(toks.some(t => t.type === 'AWAIT')).toBe(true);
});

test('parser: async function declaration sets async flag', () => {
  const ast = parse(lex('async function f(a){ return await a; }'));
  const fn = ast.body[0];
  expect(fn.type).toBe('FuncDecl');
  expect(fn.async).toBe(true);
  expect(fn.name).toBe('f');
  expect(fn.body.body[0].type).toBe('Return');
  expect(fn.body.body[0].value.type).toBe('Await');
});

test('parser: async function expression sets async flag', () => {
  const ast = parse(lex('let f = async function(x){ return await x; };'));
  const decl = ast.body[0];
  expect(decl.type).toBe('VarDecl');
  expect(decl.init.type).toBe('FuncExpr');
  expect(decl.init.async).toBe(true);
  expect(decl.init.body.body[0].value.type).toBe('Await');
});

test('parser: non-async function expression keeps async false', () => {
  const ast = parse(lex('let f = function(x){ return x; };'));
  const fn = ast.body[0].init;
  expect(fn.type).toBe('FuncExpr');
  expect(fn.async).toBe(false);
});

test('await precedence: binds as unary expression', () => {
  const ast = parse(lex('let y = await x + 1;'));
  const init = ast.body[0].init;
  expect(init.type).toBe('Binary');
  expect(init.op).toBe('+');
  expect(init.left.type).toBe('Await');
  expect(init.left.expr.type).toBe('Identifier');
  expect(init.left.expr.name).toBe('x');
  expect(init.right.type).toBe('Literal');
  expect(init.right.value).toBe(1);
});

test('await wraps call/member chain expression', () => {
  const ast = parse(lex('let z = await foo.bar(1);'));
  const awaitExpr = ast.body[0].init;
  expect(awaitExpr.type).toBe('Await');
  expect(awaitExpr.expr.type).toBe('Call');
});
