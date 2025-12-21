
import { panic } from './common.js';

export default function parse(tokens) {
  let i = 0;
  function peek() { return tokens[i]; }
  function at(type) { return peek().type === type; }
  function next() { return tokens[i++]; }
  function expect(type, msg) {
    if (!at(type)) panic(msg ?? `Expected ${type} but found ${peek().type}`, peek());
    return next();
  }

  function program() {
    const body = [];
    while (!at('EOF')) body.push(stmt());
    return { type:'Program', body };
  }

  function block() {
    expect('LBRACE', "Expected '{'");
    const body = [];
    while (!at('RBRACE')) body.push(stmt());
    expect('RBRACE', "Expected '}'");
    return { type:'Block', body };
  }

  function stmt() {
    if (at('LET')) return varDecl();
    if (at('IF')) return ifStmt();
    if (at('WHILE')) return whileStmt();
    if (at('FUNCTION')) return funcDecl();
    if (at('RETURN')) return returnStmt();
    if (at('CLASS')) return classDecl();
    if (at('LBRACE')) return block();
    const e = expr();
    expect('SEMI', "Expected ';' after expression");
    return { type:'ExprStmt', expr:e };
  }

  function varDecl() {
    next(); // LET
    const nameTok = expect('IDENT', "Expected variable name");
    let init = null;
    if (at('EQUAL')) { next(); init = expr(); }
    expect('SEMI', "Expected ';' after variable declaration");
    return { type:'VarDecl', name: nameTok.value, init };
  }

  function ifStmt() {
    next(); // IF
    expect('LPAREN', "Expected '(' after if");
    const cond = expr();
    expect('RPAREN', "Expected ')'");
    const then = at('LBRACE') ? block() : stmt();
    let els = null;
    if (at('ELSE')) { next(); els = at('LBRACE') ? block() : stmt(); }
    return { type:'If', cond, then, else: els };
  }

  function whileStmt() {
    next(); // WHILE
    expect('LPAREN', "Expected '(' after while");
    const cond = expr();
    expect('RPAREN', "Expected ')'");
    const body = at('LBRACE') ? block() : stmt();
    return { type:'While', cond, body };
  }

  function funcDecl() {
    next(); // FUNCTION
    const name = expect('IDENT', "Expected function name").value;
    expect('LPAREN', "Expected '('");
    const params = [];
    if (!at('RPAREN')) {
      do { params.push(expect('IDENT', "Expected parameter name").value); }
      while (at('COMMA') && next());
    }
    expect('RPAREN', "Expected ')'");
    const body = block();
    return { type:'FuncDecl', name, params, body };
  }

  function returnStmt() {
    next(); // RETURN
    let value = null;
    if (!at('SEMI')) value = expr();
    expect('SEMI', "Expected ';' after return");
    return { type:'Return', value };
  }

  // --- Classes ---
  function classDecl() {
    next(); // CLASS
    const name = expect('IDENT', "Expected class name").value;
    let superName = null;
    if (at('EXTENDS')) { next(); superName = expect('IDENT', "Expected base class name after 'extends'").value; }
    expect('LBRACE', "Expected '{' after class header");
    let ctor = null;
    const methods = [];
    while (!at('RBRACE')) {
      const nameTok = expect('IDENT', "Expected method name or 'constructor'");
      const mname = nameTok.value;
      expect('LPAREN', "Expected '('");
      const params = [];
      if (!at('RPAREN')) {
        do { params.push(expect('IDENT', "Expected parameter name").value); }
        while (at('COMMA') && next());
      }
      expect('RPAREN', "Expected ')'");
      const body = block();
      if (mname === 'constructor') ctor = { params, body };
      else methods.push({ name:mname, params, body });
    }
    expect('RBRACE', "Expected '}' after class body");
    return { type:'ClassDecl', name, superName, ctor, methods };
  }

  // Expressions
  function expr() { return assignment(); }

  function assignment() {
    const left = logicOr();
    if (at('EQUAL')) {
      const eq = next();
      const right = assignment();
      if (left.type === 'Identifier') return { type:'Assign', name:left.name, value:right };
      if (left.type === 'Member') return { type:'PropAssign', object:left.object, property:left.property, computed:left.computed, value:right };
      panic("Invalid assignment target", eq);
    }
    return left;
  }

  function logicOr() {
    let left = logicAnd();
    while (at('||')) { next(); const right = logicAnd(); left = { type:'Logical', op:'||', left, right }; }
    return left;
  }

  function logicAnd() {
    let left = equality();
    while (at('&&')) { next(); const right = equality(); left = { type:'Logical', op:'&&', left, right }; }
    return left;
  }

  function equality() {
    let left = comparison();
    while (at('==') || at('!=')) {
      const t = next().type;
      const right = comparison();
      left = { type:'Binary', op:t, left, right };
    }
    return left;
  }

  function comparison() {
    let left = term();
    while (at('LT') || at('GT') || at('<=') || at('>=')) {
      const t = next().type;
      const op = ({LT:'<', GT:'>', '<=':'<=', '>=':'>='})[t] ?? t;
      const right = term();
      left = { type:'Binary', op, left, right };
    }
    return left;
  }

  function term() {
    let left = factor();
    while (at('PLUS') || at('MINUS')) {
      const op = next().type === 'PLUS' ? '+' : '-';
      const right = factor();
      left = { type:'Binary', op, left, right };
    }
    return left;
  }

  function factor() {
    let left = unary();
    while (at('STAR') || at('SLASH') || at('PERCENT')) {
      const t = next().type;
      const op = t === 'STAR' ? '*' : (t === 'SLASH' ? '/' : '%');
      const right = unary();
      left = { type:'Binary', op, left, right };
    }
    return left;
  }

  function unary() {
    if (at('BANG') || at('MINUS')) {
      const t = next().type;
      const op = t === 'BANG' ? '!' : '-';
      const right = unary();
      return { type:'Unary', op, expr:right };
    }
    if (at('NEW')) return newExpr();
    return call();
  }

  function newExpr() {
    next(); // NEW
    const className = expect('IDENT', "Expected class name after 'new'").value;
    expect('LPAREN', "Expected '(' after class name");
    const args = [];
    if (!at('RPAREN')) {
      do { args.push(expr()); } while (at('COMMA') && next());
    }
    expect('RPAREN', "Expected ')'");
    return { type:'NewExpr', className, args };
  }

  function call() {
    let callee = primary();
    for (;;) {
      if (at('LPAREN')) {
        next();
        const args = [];
        if (!at('RPAREN')) {
          do { args.push(expr()); } while (at('COMMA') && next());
        }
        expect('RPAREN', "Expected ')'");
        // Special super(...) call
        if (callee.type === 'Super') {
          callee = { type:'CallSuperCtor', args };
        } else if (callee.type === 'Member' && callee.object.type === 'Super' && !callee.computed) {
          const methodName = callee.property.value; // literal string
          callee = { type:'CallSuperMethod', name:methodName, args };
        } else {
          callee = { type:'Call', callee, args };
        }
        continue;
      }
      if (at('DOT')) {
        next();
        const nameTok = expect('IDENT', "Expected property name after '.'");
        const keyLit = { type:'Literal', value: String(nameTok.value) };
        callee = { type:'Member', object: callee, property: keyLit, computed:false };
        continue;
      }
      if (at('LBRACK')) {
        next();
        const keyExpr = expr();
        expect('RBRACK', "Expected ']'");
        callee = { type:'Member', object: callee, property: keyExpr, computed:true };
        continue;
      }
      break;
    }
    return callee;
  }

  function primary() {
    if (at('NUMBER')) return { type:'Literal', value: next().value };
    if (at('STRING')) return { type:'Literal', value: next().value };
    if (at('TRUE')) { next(); return { type:'Literal', value:true }; }
    if (at('FALSE')) { next(); return { type:'Literal', value:false }; }
    if (at('NULL')) { next(); return { type:'Literal', value:null }; }
    if (at('THIS')) { next(); return { type:'This' }; }
    if (at('SUPER')) { next(); return { type:'Super' }; }
    if (at('IDENT')) return { type:'Identifier', name: next().value };
    if (at('LPAREN')) { next(); const e=expr(); expect('RPAREN',"Expected ')'"); return e; }
    if (at('LBRACE')) return objectLiteral();
    if (at('LBRACK')) return arrayLiteral();
    panic("Expected expression", peek());
  }

  function objectLiteral() {
    expect('LBRACE', "Expected '{' for object literal");
    const props = [];
    if (!at('RBRACE')) {
      do {
        let keyLit;
        if (at('IDENT')) keyLit = { type:'Literal', value: String(next().value) };
        else if (at('STRING')) keyLit = { type:'Literal', value: String(next().value) };
        else panic("Expected property name (identifier or string)", peek());
        expect('COLON', "Expected ':' after property name");
        const valueExpr = expr();
        props.push({ key:keyLit, value:valueExpr });
      } while (at('COMMA') && next());
    }
    expect('RBRACE', "Expected '}' to close object literal");
    return { type:'ObjectLiteral', props };
  }

  function arrayLiteral() {
    expect('LBRACK', "Expected '[' for array literal");
    const elements = [];
    if (!at('RBRACK')) {
      for (;;) {
        elements.push(expr());
        if (at('COMMA')) { next(); if (at('RBRACK')) break; continue; }
        break;
      }
    }
    expect('RBRACK', "Expected ']'");
    return { type:'ArrayLiteral', elements };
  }

  return program();
}
