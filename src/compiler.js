
import { panic } from './common.js';

export default function compile(ast) {
  const functions = [];
  const classes = []; // meta: {name, superName, ctorIndex, methods:[{name, funcIndex}]}

  const bytecodeVersion = 1;

  let currentLoc = null;
  function withLoc(loc, fnBody) {
    const prev = currentLoc;
    currentLoc = loc ?? prev;
    try { return fnBody(); }
    finally { currentLoc = prev; }
  }

  function newFunc(name, params) {
    const fn = { name, params, consts: [], code: [], arity: params.length };
    functions.push(fn);
    return fn;
  }
  function constIndex(fn, v) {
    const idx = fn.consts.findIndex(x => JSON.stringify(x) === JSON.stringify(v));
    if (idx >= 0) return idx;
    fn.consts.push(v);
    return fn.consts.length - 1;
  }
  function emit(fn, op, a=null, b=null) {
    fn.code.push({ op, a, b, loc: currentLoc });
    return fn.code.length - 1;
  }
  function patch(fn, idx, aNew) { fn.code[idx].a = aNew; }

  const main = newFunc('(main)', []);
  compileBlockLike(main, ast.body);
  // Only emit CONST null if the last statement is not an ExprStmt
  const lastStmt = ast.body[ast.body.length - 1];
  if (!lastStmt || lastStmt.type !== 'ExprStmt') {
    emit(main, 'CONST', constIndex(main, {type:'null'}));
  }
  emit(main, 'RET');

  return { bytecodeVersion, functions, classes };

  function compileBlockLike(fn, stmts) {
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      const isLast = i === stmts.length - 1;
      withLoc(s.loc, () => compileStmt(fn, s, isLast));
    }
  }

  function compileStmt(fn, s, isLast = false) {
    if (s?.loc) currentLoc = s.loc;
    switch (s.type) {
      case 'VarDecl':
        if (s.init) compileExpr(fn, s.init); else emit(fn,'CONST',constIndex(fn,{type:'null'}));
        emit(fn,'DEFINE_NAME',s.name);
        break;
      case 'ConstDecl':
        compileExpr(fn, s.init);
        emit(fn, 'DEFINE_CONST', s.name);
        break;
      case 'ExprStmt':
        compileExpr(fn, s.expr);
        if (!isLast) emit(fn,'POP');
        break;
      case 'Block':
        emit(fn, 'SCOPE_PUSH');
        for (const inner of s.body) compileStmt(fn, inner);
        emit(fn, 'SCOPE_POP');
        break;
      case 'If':
        compileExpr(fn, s.cond);
        const jf = emit(fn,'JMP_IF_FALSE',null);
        emit(fn,'POP');
        compileStmt(fn, s.then);
        if (s.else) {
          const jend = emit(fn,'JMP',null);
          patch(fn, jf, fn.code.length);
          emit(fn,'POP');
          compileStmt(fn, s.else);
          patch(fn, jend, fn.code.length);
        } else {
          patch(fn, jf, fn.code.length);
          emit(fn,'POP');
        }
        break;
      case 'While': {
        const start = fn.code.length;
        compileExpr(fn, s.cond);
        const jfalse = emit(fn,'JMP_IF_FALSE',null);
        emit(fn,'POP');
        compileStmt(fn, s.body);
        emit(fn,'JMP', start);
        patch(fn, jfalse, fn.code.length);
        emit(fn,'POP');
        break;
      }
      case 'FuncDecl': {
        const f = newFunc(s.name, s.params);
        compileBlockLike(f, s.body.body);
        emit(f,'CONST',constIndex(f,{type:'null'}));
        emit(f,'RET');
        emit(fn,'MAKE_FUNCTION',functions.indexOf(f));
        emit(fn,'DEFINE_NAME',s.name);
        break;
      }
      case 'ClassDecl': {
        let ctorIndex = null;
        if (s.ctor) {
          const f = newFunc(`${s.name}.constructor`, s.ctor.params);
          compileBlockLike(f, s.ctor.body.body);
          emit(f,'CONST',constIndex(f,{type:'null'}));
          emit(f,'RET');
          ctorIndex = functions.indexOf(f);
        }
        const methodEntries = [];
        for (const m of s.methods) {
          const f = newFunc(`${s.name}.${m.name}`, m.params);
          compileBlockLike(f, m.body.body);
          emit(f,'CONST',constIndex(f,{type:'null'}));
          emit(f,'RET');
          methodEntries.push({ name:m.name, funcIndex:functions.indexOf(f) });
        }
        const cidx = classes.push({ name:s.name, superName:s.superName, ctorIndex, methods:methodEntries }) - 1;
        emit(fn,'MAKE_CLASS', cidx);
        emit(fn,'DEFINE_NAME', s.name);
        break;
      }
      case 'Return':
        if (s.value) compileExpr(fn, s.value); else emit(fn,'CONST',constIndex(fn,{type:'null'}));
        emit(fn,'RET'); break;
      default: panic('Unknown statement: '+s.type);
    }
  }

  function compileExpr(fn, e) {
    if (e?.loc) currentLoc = e.loc;
    switch (e.type) {
      case 'Literal': emit(fn,'CONST',constIndex(fn, boxLiteral(e.value))); break;
      case 'TemplateLiteral': {
        // Lower to left-to-right string concatenation.
        // quasis length is expressions length + 1 (allow empty chunks).
        const first = String(e.quasis?.[0] ?? '');
        emit(fn,'CONST',constIndex(fn, { type: 'str', value: first }));
        for (let i = 0; i < e.expressions.length; i++) {
          compileExpr(fn, e.expressions[i]);
          emit(fn, 'ADD');
          const tail = String(e.quasis?.[i + 1] ?? '');
          emit(fn,'CONST',constIndex(fn, { type: 'str', value: tail }));
          emit(fn, 'ADD');
        }
        break;
      }
      case 'Identifier': emit(fn,'LOAD_NAME', e.name); break;
      case 'This': emit(fn,'LOAD_THIS'); break;
      case 'NewExpr':
        emit(fn,'LOAD_NAME', e.className);
        for (const a of e.args) compileExpr(fn,a);
        emit(fn,'NEW', e.args.length);
        break;
      case 'Assign':
        compileExpr(fn, e.value);
        emit(fn,'STORE_NAME', e.name);
        break;
      case 'Unary':
        compileExpr(fn, e.expr);
        if (e.op==='!') emit(fn,'NOT'); else if (e.op==='-') emit(fn,'NEG'); else panic('Bad unary');
        break;
      case 'Binary':
        compileExpr(fn, e.left);
        compileExpr(fn, e.right);
        emit(fn, ({'+':'ADD','-':'SUB','*':'MUL','/':'DIV','%':'MOD',
                   '<':'LT','>':'GT','<=':'LE','>=':'GE',
                   '==':'EQ','!=':'NE',
                   '===':'SEQ','!==':'SNE'})[e.op]);
        break;
      case 'Logical':
        compileExpr(fn, e.left);
        if (e.op==='||') {
          const jt = emit(fn,'JMP_IF_TRUE', null);
          emit(fn,'POP');
          compileExpr(fn, e.right);
          patch(fn, jt, fn.code.length);
        } else {
          const jf = emit(fn,'JMP_IF_FALSE', null);
          emit(fn,'POP');
          compileExpr(fn, e.right);
          patch(fn, jf, fn.code.length);
        }
        break;
      case 'Conditional': {
        compileExpr(fn, e.test);
        const jf = emit(fn, 'JMP_IF_FALSE', null);
        emit(fn, 'POP');
        compileExpr(fn, e.consequent);
        const jend = emit(fn, 'JMP', null);
        patch(fn, jf, fn.code.length);
        emit(fn, 'POP');
        compileExpr(fn, e.alternate);
        patch(fn, jend, fn.code.length);
        break;
      }
      case 'NullishCoalesce':
        compileExpr(fn, e.left);
        compileExpr(fn, e.right);
        emit(fn, 'NULLISH_COALESCE');
        break;
      case 'Call':
        if (e.callee.type==='Member') {
          if (e.callee.computed) {
            compileExpr(fn, e.callee.object);
            compileExpr(fn, e.callee.property);
            for (const a of e.args) compileExpr(fn, a);
            emit(fn,'CALL_ELEM', e.args.length);
          } else {
            compileExpr(fn, e.callee.object);
            compileExpr(fn, e.callee.property);
            for (const a of e.args) compileExpr(fn, a);
            emit(fn,'CALL_PROP', e.args.length);
          }
        } else {
          compileExpr(fn, e.callee);
          for (const a of e.args) compileExpr(fn, a);
          emit(fn,'CALL', e.args.length);
        }
        break;
      case 'CallSuperCtor':
        for (const a of e.args) compileExpr(fn, a);
        emit(fn,'CALL_SUPER_CTOR', e.args.length);
        break;
      case 'CallSuperMethod':
        for (const a of e.args) compileExpr(fn, a);
        emit(fn,'CALL_SUPER_METHOD', e.name, e.args.length);
        break;
      case 'ObjectLiteral':
        emit(fn,'MAKE_OBJ');
        for (const p of e.props) {
          emit(fn,'DUP');
          compileExpr(fn, p.key);
          compileExpr(fn, p.value);
          emit(fn,'SET_PROP');
          emit(fn,'POP');
        }
        break;
      case 'ArrayLiteral':
        emit(fn,'MAKE_ARR');
        for (const el of e.elements) {
          emit(fn,'DUP');
          compileExpr(fn, el);
          emit(fn,'APPEND_ELEM');
          emit(fn,'POP');
        }
        break;
      case 'OptChain':
        compileExpr(fn, e.object);
        if (e.chainType === 'prop') {
          compileExpr(fn, e.property);
          emit(fn, 'OPT_CHAIN_PROP');
        } else if (e.chainType === 'elem') {
          compileExpr(fn, e.property);
          emit(fn, 'OPT_CHAIN_ELEM');
        } else if (e.chainType === 'call') {
          const argc = e.args.length;
          for (const a of e.args) compileExpr(fn, a);
          emit(fn, 'OPT_CHAIN_CALL', argc);
        } else {
          panic('Unknown OptChain type: ' + e.chainType);
        }
        break;

      case 'FuncExpr': {
        // Function expressions create closures. Named function expressions bind
        // the name only within the function body (not in the outer scope).
        const internalName = e.name != null ? String(e.name) : '<anonymous>';
        const f = newFunc(internalName, e.params);
        compileBlockLike(f, e.body.body);
        emit(f, 'CONST', constIndex(f, { type: 'null' }));
        emit(f, 'RET');
        emit(fn, 'MAKE_FUNCTION', functions.indexOf(f));
        if (e.name != null) {
          // Tag the closure so the VM binds it as a const in the callee env.
          // Stack top is the closure value; we just annotate it via a new opcode.
          emit(fn, 'BIND_FUNC_NAME', e.name);
        }
        break;
      }

      case 'ArrowFunc': {
        const f = newFunc('<arrow>', e.params);
        if (e.bodyType === 'expr') {
          compileExpr(f, e.body);
          emit(f, 'RET');
        } else {
          compileBlockLike(f, e.body.body);
          emit(f, 'CONST', constIndex(f, { type: 'null' }));
          emit(f, 'RET');
        }
        emit(fn, 'MAKE_FUNCTION', functions.indexOf(f));
        emit(fn, 'CAPTURE_THIS');
        break;
      }
      case 'Member':
        compileExpr(fn, e.object);
        compileExpr(fn, e.property);
        emit(fn, e.computed ? 'GET_ELEM' : 'GET_PROP');
        break;
      case 'PropAssign':
        compileExpr(fn, e.object);
        compileExpr(fn, e.property);
        compileExpr(fn, e.value);
        emit(fn, e.computed ? 'SET_ELEM' : 'SET_PROP');
        break;
      default: panic('Unknown expr: '+e.type);
    }
  }

  function boxLiteral(x) {
    if (x === null) return {type:'null'};
    if (x === undefined) return {type:'undef'};
    switch (typeof x) {
      case 'number': return {type:'num', value:x};
      case 'string': return {type:'str', value:x};
      case 'boolean': return {type:'bool', value:x};
      default: panic('Unsupported literal type');
    }
  }
}
