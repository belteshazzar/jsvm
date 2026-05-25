
import { panic } from './common.js';

export default function compile(ast) {
  const consts = [];
  const functions = [];
  const classes = []; // meta: {name, superName, ctorIndex, methods:[{name, funcIndex}]}
  const imports = []; // Track imports: { source, specifiers: [{imported, local}] }
  const exports = []; // Track named exports: { exported: name, local: name }
  let defaultExport = null; // Track default export value (if any)
  const reExports = []; // Track re-exports: { source, specifiers }

  const bytecodeVersion = 1;

  let currentLoc = null;
  function withLoc(loc, fnBody) {
    const prev = currentLoc;
    currentLoc = loc ?? prev;
    try { return fnBody(); }
    finally { currentLoc = prev; }
  }

  function newFunc(name, params, opts = {}) {
    const fn = {
      name,
      params,
      code: [],
      arity: params.length,
      async: !!opts.async,
      awaitSites: [],
    };
    functions.push(fn);
    return fn;
  }
  function constIndex(v) {
    const idx = consts.findIndex(x => JSON.stringify(x) === JSON.stringify(v));
    if (idx >= 0) return idx;
    consts.push(v);
    return consts.length - 1;
  }
  function emit(fn, op, a=null, b=null) {
    fn.code.push({ op, a, b, loc: currentLoc });
    return fn.code.length - 1;
  }
    function emitPropOperand(fn, propNode, computed) {
      if (!computed && propNode && propNode.type === 'Identifier') {
        emit(fn, 'CONST', constIndex({ type: 'str', value: propNode.name }));
      } else {
        compileExpr(fn, propNode);
      }
    }
  function patch(fn, idx, aNew) { fn.code[idx].a = aNew; }

  const controlStack = [];
  const functionContextStack = [];

  function withFunctionContext(ctx, fnBody) {
    functionContextStack.push(ctx);
    try { return fnBody(); }
    finally { functionContextStack.pop(); }
  }

  function currentFunctionContext() {
    return functionContextStack[functionContextStack.length - 1] ?? null;
  }
  function nearestBreakTarget() {
    for (let i = controlStack.length - 1; i >= 0; i--) {
      const c = controlStack[i];
      if (c.kind === 'loop' || c.kind === 'switch') return c;
    }
    return null;
  }
  function nearestLoopTarget() {
    for (let i = controlStack.length - 1; i >= 0; i--) {
      const c = controlStack[i];
      if (c.kind === 'loop') return c;
    }
    return null;
  }

  const main = newFunc('(main)', [], { async: false });
  withFunctionContext({ async: false, name: '(main)' }, () => {
    compileBlockLike(main, ast.body);
  });
  
  // Build __exports object if module has exports, re-exports, or default export
  const hasNamedExports = exports.length > 0;
  const hasReExports = reExports.length > 0;
  const hasDefaultExport = defaultExport !== null;
  
  if (hasNamedExports || hasReExports || hasDefaultExport) {
    emit(main, 'MAKE_OBJ');
    
    // Add named exports
    for (const exp of exports) {
      emit(main, 'DUP');
      emit(main, 'CONST', constIndex({ type: 'str', value: exp.exported }));
      emit(main, 'LOAD_NAME', exp.local);
      emit(main, 'SET_PROP');
      emit(main, 'POP');
    }
    
    // Add re-exported values
    for (const reExp of reExports) {
      // Import the module
      emit(main, 'IMPORT', constIndex({ type: 'str', value: reExp.source }), constIndex({ type: 'arr', items: reExp.specifiers.map(spec => ({ type: 'obj', map: { imported: { type: 'str', value: spec.local }, local: { type: 'str', value: spec.local } } })) }));
      // Add each re-exported item to __exports
      for (const spec of reExp.specifiers) {
        emit(main, 'DUP');
        emit(main, 'CONST', constIndex({ type: 'str', value: spec.exported }));
        // Stack: __exports, key, imported_value (from IMPORT)
        // We need to extract the value for this spec
        emit(main, 'LOAD_NAME', spec.local);
        emit(main, 'SET_PROP');
        emit(main, 'POP');
      }
    }
    
    // Add default export if present
    if (hasDefaultExport) {
      emit(main, 'DUP');
      emit(main, 'CONST', constIndex({ type: 'str', value: 'default' }));
      compileExpr(main, defaultExport);
      emit(main, 'SET_PROP');
      emit(main, 'POP');
    }
    
    emit(main, 'RET');
  } else {
    // Only emit CONST null if the last statement is not an ExprStmt
    const lastStmt = ast.body[ast.body.length - 1];
    if (!lastStmt || lastStmt.type !== 'ExprStmt') {
      emit(main, 'CONST', constIndex({type:'null'}));
    }
    emit(main, 'RET');
  }

  return { bytecodeVersion, consts, functions, classes, imports, exports, defaultExport, reExports };

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
      case 'ImportDeclaration':
        imports.push({
          source: s.source,
          specifiers: s.specifiers.map(spec => ({ imported: spec.imported, local: spec.local })),
        });
        // Emit IMPORT instruction with source name and specifier list
        emit(fn, 'IMPORT', constIndex({ type: 'str', value: s.source }), constIndex({ type: 'arr', items: s.specifiers.map(spec => ({ type: 'obj', map: { imported: { type: 'str', value: spec.imported }, local: { type: 'str', value: spec.local } } })) }));
        // Specifiers are bound in the current scope
        for (const spec of s.specifiers) {
          emit(fn, 'DEFINE_NAME', spec.local);
        }
        break;
      case 'ExportNamedDeclaration':
        // Track exports for module metadata
        for (const spec of s.specifiers) {
          exports.push({ exported: spec.exported, local: spec.local });
        }
        break;
      case 'ExportDefaultDeclaration':
        // Track default export
        defaultExport = s.value;
        break;
      case 'ExportNamedFromDeclaration':
        // Re-exports: import { x } from '...' and add to exports
        reExports.push({ source: s.source, specifiers: s.specifiers });
        break;
      case 'ExportFunctionDeclaration':
        // export function f() {}
        compileStmt(fn, s.declaration);
        exports.push({ exported: s.declaration.name, local: s.declaration.name });
        break;
      case 'ExportClassDeclaration':
        // export class C {}
        compileStmt(fn, s.declaration);
        exports.push({ exported: s.declaration.name, local: s.declaration.name });
        break;
      case 'ExportConstDeclaration':
        // export const x = value;
        compileStmt(fn, s.declaration);
        exports.push({ exported: s.declaration.name, local: s.declaration.name });
        break;
      case 'ExportVarDeclaration':
        // export let x = value;
        compileStmt(fn, s.declaration);
        exports.push({ exported: s.declaration.name, local: s.declaration.name });
        break;
      case 'VarDecl':
        if (s.init) compileExpr(fn, s.init); else emit(fn,'CONST',constIndex({type:'null'}));
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

        const loopCtx = { kind:'loop', breakJumps:[], continueJumps:[] };
        controlStack.push(loopCtx);
        compileStmt(fn, s.body);

        for (const j of loopCtx.continueJumps) patch(fn, j, start);
        emit(fn,'JMP', start);

        const falsePath = fn.code.length;
        patch(fn, jfalse, falsePath);
        emit(fn,'POP');

        const end = fn.code.length;
        for (const j of loopCtx.breakJumps) patch(fn, j, end);
        controlStack.pop();
        break;
      }
      case 'For': {
        if (s.init) {
          if (s.init.type === 'VarDecl' || s.init.type === 'ConstDecl') {
            compileStmt(fn, s.init);
          } else {
            compileExpr(fn, s.init);
            emit(fn, 'POP');
          }
        }

        const condStart = fn.code.length;
        let jfalse = null;
        if (s.cond) {
          compileExpr(fn, s.cond);
          jfalse = emit(fn, 'JMP_IF_FALSE', null);
          emit(fn, 'POP');
        }

        const loopCtx = { kind:'loop', breakJumps:[], continueJumps:[] };
        controlStack.push(loopCtx);
        compileStmt(fn, s.body);

        const postStart = fn.code.length;
        for (const j of loopCtx.continueJumps) patch(fn, j, postStart);
        if (s.post) {
          compileExpr(fn, s.post);
          emit(fn, 'POP');
        }
        emit(fn, 'JMP', condStart);

        if (jfalse != null) {
          const falsePath = fn.code.length;
          patch(fn, jfalse, falsePath);
          emit(fn, 'POP');
        }

        const end = fn.code.length;
        for (const j of loopCtx.breakJumps) patch(fn, j, end);
        controlStack.pop();
        break;
      }
      case 'ForIn':
      case 'ForOf': {
        let targetName = null;
        if (s.left.type === 'VarDecl') {
          emit(fn,'CONST',constIndex({type:'null'}));
          emit(fn,'DEFINE_NAME',s.left.name);
          targetName = s.left.name;
        } else if (s.left.type === 'ConstDecl') {
          panic('const loop bindings are not supported for for-in/of yet');
        } else if (s.left.type === 'Identifier') {
          targetName = s.left.name;
        } else {
          panic('Invalid for-in/of assignment target: ' + s.left.type);
        }

        compileExpr(fn, s.right);
        emit(fn, s.type === 'ForIn' ? 'ITER_INIT_IN' : 'ITER_INIT_OF');
        const iterTmp = `__iter_${fn.code.length}`;
        emit(fn, 'DEFINE_NAME', iterTmp);

        const start = fn.code.length;
        emit(fn, 'LOAD_NAME', iterTmp);
        emit(fn, 'ITER_HAS_NEXT');
        const jfalse = emit(fn, 'JMP_IF_FALSE', null);
        emit(fn, 'POP');

        emit(fn, 'LOAD_NAME', iterTmp);
        emit(fn, 'ITER_GET_NEXT');
        emit(fn, 'STORE_NAME', targetName);
        emit(fn, 'POP');

        const loopCtx = { kind:'loop', breakJumps:[], continueJumps:[] };
        controlStack.push(loopCtx);
        compileStmt(fn, s.body);

        for (const j of loopCtx.continueJumps) patch(fn, j, start);
        emit(fn, 'JMP', start);

        const falsePath = fn.code.length;
        patch(fn, jfalse, falsePath);
        emit(fn, 'POP');

        const end = fn.code.length;
        for (const j of loopCtx.breakJumps) patch(fn, j, end);
        controlStack.pop();
        break;
      }
      case 'Switch': {
        // Lower `switch` using strict case matching and fallthrough.
        //
        // Build jump targets for each case body; once we enter any case body,
        // execution falls through into subsequent bodies until a `break`.
        //
        // Stack discipline:
        // - During test phase: keep discriminant on stack.
        // - Right before entering the first selected body: pop discriminant.
        // - If no match and default exists: pop discriminant before default.
        // - If no match and no default: pop discriminant and continue.
        // Evaluate discriminant once, store it so comparisons don't rely on
        // fragile stack shuffling and constant indices.
        const discTmp = `__switch_disc_${fn.code.length}`;
        compileExpr(fn, s.disc);
        emit(fn, 'DEFINE_NAME', discTmp);

        const caseBodyJumps = [];
        for (const c of s.cases) {
          emit(fn, 'LOAD_NAME', discTmp);
          compileExpr(fn, c.test);
          emit(fn, 'EQ');
          const j = emit(fn, 'JMP_IF_TRUE', null);
          caseBodyJumps.push({ jumpIndex: j, caseNode: c });
        }

        const jNoMatch = emit(fn, 'JMP', null);

        const endOfBodiesJumps = [];
        let discCleaned = false;

        const switchCtx = { kind:'switch', breakJumps:[] };
        controlStack.push(switchCtx);

        for (const { jumpIndex, caseNode } of caseBodyJumps) {
          patch(fn, jumpIndex, fn.code.length);
          if (!discCleaned) {
            // Remove temp from scope by assigning null (no delete op in VM).
            emit(fn, 'CONST', constIndex({ type: 'null' }));
            emit(fn, 'STORE_NAME', discTmp);
            discCleaned = true;
          }
          for (const st of caseNode.body) {
            compileStmt(fn, st);
          }
        }

        // If we entered a case body, skip default by jumping to end.
        if (discCleaned) {
          endOfBodiesJumps.push(emit(fn, 'JMP', null));
        }

        const defaultStart = fn.code.length;
        patch(fn, jNoMatch, defaultStart);
        if (s.defaultCase) {
          if (!discCleaned) {
            emit(fn, 'CONST', constIndex({ type: 'null' }));
            emit(fn, 'STORE_NAME', discTmp);
            discCleaned = true;
          }
          for (const st of s.defaultCase.body) {
            compileStmt(fn, st);
          }
        } else {
          if (!discCleaned) {
            emit(fn, 'CONST', constIndex({ type: 'null' }));
            emit(fn, 'STORE_NAME', discTmp);
            discCleaned = true;
          }
        }

        const end = fn.code.length;
        for (const j of switchCtx.breakJumps) patch(fn, j, end);
        for (const j of endOfBodiesJumps) patch(fn, j, end);
        controlStack.pop();

        emit(fn, 'CONST', constIndex({ type: 'null' }));
        break;
      }
      case 'Break': {
        const target = nearestBreakTarget();
        if (!target) panic("'break' not within loop or switch");
        target.breakJumps.push(emit(fn, 'JMP', null));
        break;
      }
      case 'Continue': {
        const loop = nearestLoopTarget();
        if (!loop) panic("'continue' not within loop");
        loop.continueJumps.push(emit(fn, 'JMP', null));
        break;
      }
      case 'FuncDecl': {
        const f = newFunc(s.name, s.params, { async: !!s.async });
        withFunctionContext({ async: !!s.async, name: s.name }, () => {
          compileBlockLike(f, s.body.body);
        });
        emit(f,'CONST',constIndex({type:'null'}));
        emit(f,'RET');
        emit(fn,'MAKE_FUNCTION',functions.indexOf(f));
        emit(fn,'DEFINE_NAME',s.name);
        break;
      }
      case 'ClassDecl': {
        let ctorIndex = null;
        if (s.ctor) {
          const f = newFunc(`${s.name}.constructor`, s.ctor.params, { async: !!s.ctor.async });
          withFunctionContext({ async: !!s.ctor.async, name: `${s.name}.constructor` }, () => {
            compileBlockLike(f, s.ctor.body.body);
          });
          emit(f,'CONST',constIndex({type:'null'}));
          emit(f,'RET');
          ctorIndex = functions.indexOf(f);
        }
        const methodEntries = [];
        for (const m of s.methods) {
          const f = newFunc(`${s.name}.${m.name}`, m.params, { async: !!m.async });
          withFunctionContext({ async: !!m.async, name: `${s.name}.${m.name}` }, () => {
            compileBlockLike(f, m.body.body);
          });
          emit(f,'CONST',constIndex({type:'null'}));
          emit(f,'RET');
          methodEntries.push({ name:m.name, funcIndex:functions.indexOf(f) });
        }
        const cidx = classes.push({ name:s.name, superName:s.superName, ctorIndex, methods:methodEntries }) - 1;
        emit(fn,'MAKE_CLASS', cidx);
        emit(fn,'DEFINE_NAME', s.name);
        break;
      }
      case 'Return':
        if (s.value) compileExpr(fn, s.value); else emit(fn,'CONST',constIndex({type:'null'}));
        emit(fn,'RET'); break;
      default: panic('Unknown statement: '+s.type);
    }
  }

  function compileExpr(fn, e) {
    if (e?.loc) currentLoc = e.loc;
    switch (e.type) {
      case 'Literal': emit(fn,'CONST',constIndex(boxLiteral(e.value))); break;
      case 'TemplateLiteral': {
        // Lower to left-to-right string concatenation.
        // quasis length is expressions length + 1 (allow empty chunks).
        const first = String(e.quasis?.[0] ?? '');
        emit(fn,'CONST',constIndex({ type: 'str', value: first }));
        for (let i = 0; i < e.expressions.length; i++) {
          compileExpr(fn, e.expressions[i]);
          emit(fn, 'ADD');
          const tail = String(e.quasis?.[i + 1] ?? '');
          emit(fn,'CONST',constIndex({ type: 'str', value: tail }));
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
        if (e.op==='!') emit(fn,'NOT');
        else if (e.op==='-') emit(fn,'NEG');
        else if (e.op==='typeof') emit(fn,'TYPEOF');
        else panic('Bad unary');
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
          compileExpr(fn, e.callee.object);
          emitPropOperand(fn, e.callee.property, e.callee.computed);
          for (const a of e.args) compileExpr(fn, a);
          emit(fn, e.callee.computed ? 'CALL_ELEM' : 'CALL_PROP', e.args.length);
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
        const f = newFunc(internalName, e.params, { async: !!e.async });
        withFunctionContext({ async: !!e.async, name: internalName }, () => {
          compileBlockLike(f, e.body.body);
        });
        emit(f, 'CONST', constIndex({ type: 'null' }));
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
        const f = newFunc('<arrow>', e.params, { async: !!e.async });
        withFunctionContext({ async: !!e.async, name: '<arrow>' }, () => {
          if (e.bodyType === 'expr') {
            compileExpr(f, e.body);
            emit(f, 'RET');
          } else {
            compileBlockLike(f, e.body.body);
            emit(f, 'CONST', constIndex({ type: 'null' }));
            emit(f, 'RET');
          }
        });
        emit(fn, 'MAKE_FUNCTION', functions.indexOf(f));
        emit(fn, 'CAPTURE_THIS');
        break;
      }
      case 'Await': {
        const ctx = currentFunctionContext();
        if (!ctx || !ctx.async) {
          panic("'await' is only valid in async functions");
        }
        compileExpr(fn, e.expr);
        const awaitIdx = emit(fn, 'AWAIT');
        if (!Array.isArray(fn.awaitSites)) fn.awaitSites = [];
        fn.awaitSites.push(awaitIdx);
        break;
      }
      case 'Member':
        compileExpr(fn, e.object);
        emitPropOperand(fn, e.property, e.computed);
        emit(fn, e.computed ? 'GET_ELEM' : 'GET_PROP');
        break;
      case 'PropAssign':
        compileExpr(fn, e.object);
        emitPropOperand(fn, e.property, e.computed);
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
