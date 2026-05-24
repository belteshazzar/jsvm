
import { panic } from './common.js';

export default function parse(tokens) {
  let i = 0;
  function peek() { return tokens[i]; }
  function at(type) { return peek().type === type; }
  function check(type) { return at(type); }
  function next() { return tokens[i++]; }
  function prev() { return tokens[i - 1]; }
  function match(type) { if (at(type)) { next(); return true; } return false; }
  function consume(type, msg) { return expect(type, msg); }

  function locFrom(tok) {
    if (!tok) return null;
    return { line: tok.line, col: tok.col };
  }

  function checkpoint() { return i; }
  function restore(cp) { i = cp; }
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
    const start = expect('LBRACE', "Expected '{'");
    const body = [];
    while (!at('RBRACE')) body.push(stmt());
    expect('RBRACE', "Expected '}'");
    return { type:'Block', body, loc: locFrom(start) };
  }

  function stmt() {
    if (at('LET')) return varDecl();
    if (at('CONST')) return constDecl();
    if (at('IF')) return ifStmt();
    if (at('WHILE')) return whileStmt();
    if (at('FOR')) return forStmt();
    if (at('SWITCH')) return switchStmt();
    if (at('BREAK')) return breakStmt();
    if (at('CONTINUE')) return continueStmt();
    if (at('FUNCTION')) return funcDecl();
    if (at('RETURN')) return returnStmt();
    if (at('CLASS')) return classDecl();
    if (at('LBRACE')) return block();
    const e = expr();
    expect('SEMI', "Expected ';' after expression");
    return { type:'ExprStmt', expr:e };
  }

  function breakStmt() {
    const start = next(); // BREAK
    expect('SEMI', "Expected ';' after break");
    return { type:'Break', loc: locFrom(start) };
  }

  function continueStmt() {
    const start = next(); // CONTINUE
    expect('SEMI', "Expected ';' after continue");
    return { type:'Continue', loc: locFrom(start) };
  }

  function constDecl() {
    const start = next(); // CONST
    const nameTok = expect('IDENT', 'Expected constant name');
    expect('EQUAL', "Expected '=' after const name");
    const init = expr();
    expect('SEMI', "Expected ';' after const declaration");
    return { type: 'ConstDecl', name: nameTok.value, init, loc: locFrom(start) };
  }

  function varDecl() {
    const start = next(); // LET
    const nameTok = expect('IDENT', "Expected variable name");
    let init = null;
    if (at('EQUAL')) { next(); init = expr(); }
    expect('SEMI', "Expected ';' after variable declaration");
    return { type:'VarDecl', name: nameTok.value, init, loc: locFrom(start) };
  }

  function switchStmt() {
    const start = next(); // SWITCH
    expect('LPAREN', "Expected '(' after switch");
    const disc = expr();
    expect('RPAREN', "Expected ')' after switch expression");
    expect('LBRACE', "Expected '{' after switch(...)");

    const cases = [];
    let defaultCase = null;
    while (!at('RBRACE')) {
      if (at('CASE')) {
        const cTok = next();
        const test = expr();
        expect('COLON', "Expected ':' after case expression");
        const body = [];
        while (!at('CASE') && !at('DEFAULT') && !at('RBRACE')) {
          body.push(stmt());
        }
        cases.push({ type:'Case', test, body, loc: locFrom(cTok) });
      } else if (at('DEFAULT')) {
        const dTok = next();
        expect('COLON', "Expected ':' after default");
        const body = [];
        while (!at('CASE') && !at('DEFAULT') && !at('RBRACE')) {
          body.push(stmt());
        }
        if (defaultCase) panic('Multiple default clauses in switch', dTok);
        defaultCase = { type:'Default', body, loc: locFrom(dTok) };
      } else {
        panic('Expected case or default in switch', peek());
      }
    }
    expect('RBRACE', "Expected '}' after switch cases");
    return { type:'Switch', disc, cases, defaultCase, loc: locFrom(start) };
  }

  function ifStmt() {
    const start = next(); // IF
    expect('LPAREN', "Expected '(' after if");
    const cond = expr();
    expect('RPAREN', "Expected ')'");
    const then = at('LBRACE') ? block() : stmt();
    let els = null;
    if (at('ELSE')) { next(); els = at('LBRACE') ? block() : stmt(); }
    return { type:'If', cond, then, else: els, loc: locFrom(start) };
  }

  function whileStmt() {
    const start = next(); // WHILE
    expect('LPAREN', "Expected '(' after while");
    const cond = expr();
    expect('RPAREN', "Expected ')'");
    const body = at('LBRACE') ? block() : stmt();
    return { type:'While', cond, body, loc: locFrom(start) };
  }

  function forStmt() {
    const start = next(); // FOR
    expect('LPAREN', "Expected '(' after for");

    // Classic for with empty initializer.
    if (at('SEMI')) {
      next();
      const cond = at('SEMI') ? null : expr();
      expect('SEMI', "Expected ';' after for condition");
      const post = at('RPAREN') ? null : expr();
      expect('RPAREN', "Expected ')' after for clauses");
      const body = at('LBRACE') ? block() : stmt();
      return { type: 'For', init: null, cond, post, body, loc: locFrom(start) };
    }

    // for-in / for-of with declaration binding.
    if (at('LET') || at('CONST')) {
      const kindTok = next();
      const nameTok = expect('IDENT', 'Expected loop binding name');
      const binding = {
        type: kindTok.type === 'LET' ? 'VarDecl' : 'ConstDecl',
        name: nameTok.value,
        init: null,
        loc: locFrom(kindTok),
      };

      if (at('IN') || at('OF')) {
        const kw = next();
        const right = expr();
        expect('RPAREN', "Expected ')' after for-in/of header");
        const body = at('LBRACE') ? block() : stmt();
        const nodeType = kw.type === 'IN' ? 'ForIn' : 'ForOf';
        return { type: nodeType, left: binding, right, body, loc: locFrom(start) };
      }

      if (at('EQUAL')) {
        next();
        binding.init = expr();
      }
      if (binding.type === 'ConstDecl' && binding.init == null) {
        panic('Missing initializer in const declaration', kindTok);
      }
      expect('SEMI', "Expected ';' after for initializer");
      const cond = at('SEMI') ? null : expr();
      expect('SEMI', "Expected ';' after for condition");
      const post = at('RPAREN') ? null : expr();
      expect('RPAREN', "Expected ')' after for clauses");
      const body = at('LBRACE') ? block() : stmt();
      return { type: 'For', init: binding, cond, post, body, loc: locFrom(start) };
    }

    // Expression initializer OR assignment target for for-in/of.
    const first = expr();
    if (at('IN') || at('OF')) {
      const kw = next();
      const right = expr();
      expect('RPAREN', "Expected ')' after for-in/of header");
      const body = at('LBRACE') ? block() : stmt();
      const nodeType = kw.type === 'IN' ? 'ForIn' : 'ForOf';
      return { type: nodeType, left: first, right, body, loc: locFrom(start) };
    }

    expect('SEMI', "Expected ';' after for initializer");
    const cond = at('SEMI') ? null : expr();
    expect('SEMI', "Expected ';' after for condition");
    const post = at('RPAREN') ? null : expr();
    expect('RPAREN', "Expected ')' after for clauses");
    const body = at('LBRACE') ? block() : stmt();
    return { type: 'For', init: first, cond, post, body, loc: locFrom(start) };
  }

  function funcDecl() {
    const start = next(); // FUNCTION
    const name = expect('IDENT', "Expected function name").value;
    expect('LPAREN', "Expected '('");
    const params = [];
    if (!at('RPAREN')) {
      do { params.push(expect('IDENT', "Expected parameter name").value); }
      while (at('COMMA') && next());
    }
    expect('RPAREN', "Expected ')'");
    const body = block();
    return { type:'FuncDecl', name, params, body, loc: locFrom(start) };
  }

  function returnStmt() {
    const start = next(); // RETURN
    let value = null;
    if (!at('SEMI')) value = expr();
    expect('SEMI', "Expected ';' after return");
    return { type:'Return', value, loc: locFrom(start) };
  }

  // --- Classes ---
  function classDecl() {
    const start = next(); // CLASS
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
    return { type:'ClassDecl', name, superName, ctor, methods, loc: locFrom(start) };
  }

  // Expressions
  function expr() { return assignment(); }

  function assignment() {
    const left = conditional();
    if (at('EQUAL')) {
      const eq = next();
      const right = assignment();
      if (left.type === 'Identifier') return { type:'Assign', name:left.name, value:right, loc: locFrom(eq) };
      if (left.type === 'Member') return { type:'PropAssign', object:left.object, property:left.property, computed:left.computed, value:right, loc: locFrom(eq) };
      panic("Invalid assignment target", eq);
    }
    return left;
  }

  function nullish() {
    let left = logicOr();
    while (at('DOUBLE_QMARK')) {
      const t = next();
      const right = logicOr();
      left = { type: 'NullishCoalesce', left, right, loc: locFrom(t) };
    }
    return left;
  }

  function conditional() {
    const test = nullish();
    if (!at('QMARK')) return test;
    const qm = next(); // ?
    const consequent = assignment();
    expect('COLON', "Expected ':' in conditional expression");
    const alternate = assignment();
    return { type: 'Conditional', test, consequent, alternate, loc: locFrom(qm) };
  }

  function logicOr() {
    let left = logicAnd();
    while (at('||')) { const t = next(); const right = logicAnd(); left = { type:'Logical', op:'||', left, right, loc: locFrom(t) }; }
    return left;
  }

  function logicAnd() {
    let left = equality();
    while (at('&&')) { const t = next(); const right = equality(); left = { type:'Logical', op:'&&', left, right, loc: locFrom(t) }; }
    return left;
  }

  function equality() {
    let left = comparison();
    while (at('==') || at('!=') || at('===') || at('!==')) {
      const tok = next();
      const t = tok.type;
      const right = comparison();
      left = { type:'Binary', op:t, left, right, loc: locFrom(tok) };
    }
    return left;
  }

  function comparison() {
    let left = term();
    while (at('LT') || at('GT') || at('<=') || at('>=')) {
      const tok = next();
      const t = tok.type;
      const op = ({LT:'<', GT:'>', '<=':'<=', '>=':'>='})[t] ?? t;
      const right = term();
      left = { type:'Binary', op, left, right, loc: locFrom(tok) };
    }
    return left;
  }

  function term() {
    let left = factor();
    while (at('PLUS') || at('MINUS')) {
      const tok = next();
      const op = tok.type === 'PLUS' ? '+' : '-';
      const right = factor();
      left = { type:'Binary', op, left, right, loc: locFrom(tok) };
    }
    return left;
  }

  function factor() {
    let left = unary();
    while (at('STAR') || at('SLASH') || at('PERCENT')) {
      const tok = next();
      const t = tok.type;
      const op = t === 'STAR' ? '*' : (t === 'SLASH' ? '/' : '%');
      const right = unary();
      left = { type:'Binary', op, left, right, loc: locFrom(tok) };
    }
    return left;
  }

  function unary() {
    if (at('BANG') || at('MINUS')) {
      const tok = next();
      const op = tok.type === 'BANG' ? '!' : '-';
      const right = unary();
      return { type:'Unary', op, expr:right, loc: locFrom(tok) };
    }
    if (at('TYPEOF')) {
      const tok = next();
      const right = unary();
      return { type:'Unary', op: 'typeof', expr: right, loc: locFrom(tok) };
    }
    if (at('NEW')) return newExpr();
    return call();
  }

  function newExpr() {
    const start = next(); // NEW
    const className = expect('IDENT', "Expected class name after 'new'").value;
    expect('LPAREN', "Expected '(' after class name");
    const args = [];
    if (!at('RPAREN')) {
      do { args.push(expr()); } while (at('COMMA') && next());
    }
    expect('RPAREN', "Expected ')'");
    return { type:'NewExpr', className, args, loc: locFrom(start) };
  }

  function call() {
    let callee = primary();
    for (;;) {
      if (at('QDOT')) {
        const qdot = next();
        if (at('IDENT')) {
          const nameTok = next();
          const keyLit = { type:'Literal', value: String(nameTok.value) };
          callee = { type: 'OptChain', chainType: 'prop', object: callee, property: keyLit, loc: locFrom(qdot) };
          continue;
        }
        if (at('LBRACK')) {
          const lb = next();
          const keyExpr = expr();
          expect('RBRACK', "Expected ']' after ?. [expr]");
          callee = { type: 'OptChain', chainType: 'elem', object: callee, property: keyExpr, loc: locFrom(qdot) };
          continue;
        }
        if (at('LPAREN')) {
          const lp = next();
          const args = [];
          if (!at('RPAREN')) {
            do { args.push(expr()); } while (at('COMMA') && next());
          }
          expect('RPAREN', "Expected ')' after ?. (args)");
          callee = { type: 'OptChain', chainType: 'call', object: callee, args, loc: locFrom(qdot) };
          continue;
        }
        panic("Invalid optional chain after ?.", peek());
      }
      if (at('LPAREN')) {
        const lp = next();
        const args = [];
        if (!at('RPAREN')) {
          do { args.push(expr()); } while (at('COMMA') && next());
        }
        expect('RPAREN', "Expected ')'");
        // Special super(...) call
        if (callee.type === 'Super') {
          callee = { type:'CallSuperCtor', args, loc: locFrom(lp) };
        } else if (callee.type === 'Member' && callee.object.type === 'Super' && !callee.computed) {
          const methodName = callee.property.value; // literal string
          callee = { type:'CallSuperMethod', name:methodName, args, loc: locFrom(lp) };
        } else {
          callee = { type:'Call', callee, args, loc: locFrom(lp) };
        }
        continue;
      }
      if (at('DOT')) {
        const dot = next();
        const nameTok = expect('IDENT', "Expected property name after '.'");
        const keyLit = { type:'Literal', value: String(nameTok.value) };
        callee = { type:'Member', object: callee, property: keyLit, computed:false, loc: locFrom(dot) };
        continue;
      }
      if (at('LBRACK')) {
        const lb = next();
        const keyExpr = expr();
        expect('RBRACK', "Expected ']'");
        callee = { type:'Member', object: callee, property: keyExpr, computed:true, loc: locFrom(lb) };
        continue;
      }
      break;
    }
    return callee;
  }

  function primary() {
    if (at('NUMBER')) { const t = next(); return { type:'Literal', value: t.value, loc: locFrom(t) }; }
    if (at('STRING')) { const t = next(); return { type:'Literal', value: t.value, loc: locFrom(t) }; }
    if (at('TRUE')) { const t = next(); return { type:'Literal', value:true, loc: locFrom(t) }; }
    if (at('FALSE')) { const t = next(); return { type:'Literal', value:false, loc: locFrom(t) }; }
    if (at('NULL')) { const t = next(); return { type:'Literal', value:null, loc: locFrom(t) }; }
    if (at('IDENT') && peek().value === 'undefined') { const t = next(); return { type:'Literal', value: undefined, loc: locFrom(t) }; }
    if (at('THIS')) { const t = next(); return { type:'This', loc: locFrom(t) }; }
    if (at('SUPER')) { const t = next(); return { type:'Super', loc: locFrom(t) }; }
    if (at('FUNCTION')) {
      const start = next();
      let name = null;
      if (at('IDENT')) name = next().value;
      expect('LPAREN', "Expected '('");
      const params = [];
      if (!at('RPAREN')) {
        do { params.push(expect('IDENT', 'Expected parameter name').value); }
        while (at('COMMA') && next());
      }
      expect('RPAREN', "Expected ')'");
      const body = block();
      return { type:'FuncExpr', name, params, body, loc: locFrom(start) };
    }
    if (at('IDENT')) {
      const t = next();
      // Arrow function: x => expr
      if (at('ARROW')) {
        const arrowTok = next();
        const params = [t.value];
        let body;
        let bodyType;
        if (at('LBRACE')) {
          body = block();
          bodyType = 'block';
        } else {
          body = assignment();
          bodyType = 'expr';
        }
        return { type:'ArrowFunc', params, body, bodyType, loc: locFrom(arrowTok) };
      }
      return { type:'Identifier', name: t.value, loc: locFrom(t) };
    }
    if (match('TEMPLATE_START')) {
      const startTok = prev();
      const quasis = [];
      const expressions = [];
      while (!check('TEMPLATE_END')) {
        if (match('TEMPLATE_CHUNK')) {
          quasis.push(prev().value);
          continue;
        }
        consume('TEMPLATE_EXPR_START', 'Expected `${` in template literal');
        expressions.push(expr());
        consume('TEMPLATE_EXPR_END', 'Expected `}` after template expression');
      }
      consume('TEMPLATE_END', 'Unterminated template literal');
      return { type: 'TemplateLiteral', quasis, expressions, loc: locFrom(startTok) };
    }
    if (at('LPAREN')) {
      const cp = checkpoint();
      const lp = next();

      // Try parse arrow params: () => ..., (x) => ..., (x,y) => ...
      const params = [];
      let isParamList = true;
      if (!at('RPAREN')) {
        for (;;) {
          if (!at('IDENT')) { isParamList = false; break; }
          params.push(next().value);
          if (at('COMMA')) { next(); continue; }
          break;
        }
      }
      if (isParamList && at('RPAREN')) {
        next();
        if (at('ARROW')) {
          const arrowTok = next();
          let body;
          let bodyType;
          if (at('LBRACE')) {
            body = block();
            bodyType = 'block';
          } else {
            body = assignment();
            bodyType = 'expr';
          }
          return { type:'ArrowFunc', params, body, bodyType, loc: locFrom(arrowTok) };
        }
      }

      // Not an arrow; restore and parse as grouped expression.
      restore(cp);
      next();
      const e = expr();
      expect('RPAREN',"Expected ')'");
      return e;
    }
    if (at('LBRACE')) return objectLiteral();
    if (at('LBRACK')) return arrayLiteral();
    panic("Expected expression", peek());
  }

  function objectLiteral() {
    const start = expect('LBRACE', "Expected '{' for object literal");
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
    return { type:'ObjectLiteral', props, loc: locFrom(start) };
  }

  function arrayLiteral() {
    const start = expect('LBRACK', "Expected '[' for array literal");
    const elements = [];
    if (!at('RBRACK')) {
      for (;;) {
        elements.push(expr());
        if (at('COMMA')) { next(); if (at('RBRACK')) break; continue; }
        break;
      }
    }
    expect('RBRACK', "Expected ']'");
    return { type:'ArrayLiteral', elements, loc: locFrom(start) };
  }

  return program();
}
