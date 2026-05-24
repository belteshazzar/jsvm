
import { setLastInstr, panic } from './common.js';

function formatInstr(f, instr, ip) {
  const a = instr.a == null ? '' : ' ' + String(instr.a);
  const b = instr.b == null ? '' : ' ' + String(instr.b);
  return `@${ip} ${instr.op}${a}${b} in ${f.name}`;
}

export default function createVM(bundle, { env: providedEnv, microtaskLimit = 100000 } = {}) {
  if (bundle?.bytecodeVersion !== 1) {
    const got = bundle?.bytecodeVersion;
    panic(`Unsupported bytecodeVersion ${String(got)} (expected 1)`);
  }
  const { functions, classes } = bundle;
  const consts = bundle?.consts;
  if (!Array.isArray(consts)) panic('Malformed bytecode bundle: missing global consts');
  const env = providedEnv ?? {};
  const ObjectProto = env.ObjectProto ?? null;
  const StringProto = env.StringProto ?? null;
  const NumberProto = env.NumberProto ?? null;
  const ArrayProto = env.ArrayProto ?? null;
  const PromiseProto = env.PromiseProto ?? null;

  const NumberProtoMethods = env.NumberProtoMethods ?? null;

  const builtins = env.builtins ?? {};

  // Boxing helpers moved to env.js; not needed here.

  function hydrateConst(v) {
    if (!v) return v;
    if (v.type === 'func') {
      // Recreate a closure with the current globals as its environment.
      // This matches how top-level function values behave in this VM.
      return makeClosure(v.funcIndex, globals);
    }
    if (v.type === 'native') {
      // Rehydrate native constants by name.
      const n = builtins[v.name];
      if (!n) panic('Unknown native in const pool: ' + String(v.name));
      return n;
    }
    return v;
  }

  function isTruthy(v) {
    switch (v.type) {
      case 'bool': return v.value === true;
      case 'num': return v.value !== 0 && !Number.isNaN(v.value);
      case 'str': return v.value.length > 0;
      case 'null':
      case 'undef':
        return false;
      default:
        return true;
    }
  }
  function toStringV(v) {
    switch (v.type) {
      case 'num': return String(v.value);
      case 'str': return v.value;
      case 'bool': return v.value ? 'true' : 'false';
      case 'null': return 'null';
      case 'undef': return 'undefined';
      case 'obj': return objToString(v);
      case 'arr': return arrToString(v);
      case 'class': return `<class ${v.name}>`;
      case 'instance': return instanceToString(v);
      case 'func': return `<function ${v.name ?? '<anonymous>'}>`;
      case 'native': return `<native ${v.name}>`;
      case 'promise': return `<promise ${v.state}>`;
      default: return `<${v.type}>`;
    }
  }
  function objToString(o) {
    const ks = Object.keys(o.map);
    return '{' + ks.map(k => JSON.stringify(k)+': '+toStringV(o.map[k])).join(', ') + '}';
  }
  function arrToString(a) {
    return '[' + a.items.map(toStringV).join(', ') + ']';
  }
  function instanceToString(inst) {
    const ks = Object.keys(inst.fields);
    return `${inst.cls?.name ?? 'Instance'}{` + ks.map(k => JSON.stringify(k)+': '+toStringV(inst.fields[k])).join(', ') + '}';
  }

  const isPrimitive = v => v.type==='num' || v.type==='bool' || v.type==='str' || v.type==='null' || v.type==='undef';
  const isObjectLike = v => !isPrimitive(v);
  function ensureNum(a) { if (a.type!=='num') panic('Expected number, got ' + a.type); return a.value; }
  function ensureIndex(k) {
    if (k.type!=='num') panic('Array index must be a number, got ' + k.type);
    const n=k.value, i=n|0; if (i!==n || i<0) panic('Array index must be a non-negative integer'); return i;
  }
  function keyToString(k) {
    if (k.type==='str') return k.value;
    if (k.type==='num') return String(k.value);
    if (k.type==='bool') return k.value?'true':'false';
    if (k.type==='null') return 'null';
    panic('Invalid property key type: ' + k.type);
  }
  const hasOwn = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);

  // ---- Environments (lexical) ----
  function Env(parent = null) { return { map: Object.create(null), consts: Object.create(null), parent }; }
  function envGet(env, name) {
    for (let e = env; e; e = e.parent) { if (name in e.map) return e.map[name]; }
    panic(`Undefined variable '${name}'`);
  }
  function envSet(env, name, value) {
    for (let e = env; e; e = e.parent) {
      if (name in e.map) {
        if (e.consts[name]) panic(`Assignment to constant variable '${name}'`);
        e.map[name] = value;
        return value;
      }
    }
    panic(`Undefined variable '${name}'`);
  }
  function envDefine(env, name, value) { env.map[name] = value; return value; }
  function envDefineConst(env, name, value) {
    env.map[name] = value;
    env.consts[name] = true;
    return value;
  }

  function binaryMath(op) {
    const b=stack.pop(), a=stack.pop();
    if (op==='ADD' && (a.type==='str' || b.type==='str')) { stack.push({type:'str', value: toStringV(a)+toStringV(b)}); return; }
    const an=ensureNum(a), bn=ensureNum(b);
    const r = ({ADD:an+bn, SUB:an-bn, MUL:an*bn, DIV:an/bn, MOD:an%bn})[op];
    stack.push({type:'num', value:r});
  }
  function binaryCmp(op) {
    const b=stack.pop(), a=stack.pop();
    function eq(a,b){
      if (a.type!==b.type) return false;
      if (a.type==='num'||a.type==='bool'||a.type==='str') return a.value===b.value;
      if (a.type==='null'||a.type==='undef') return true;
      return a===b;
    }
    let res;
    if (op==='EQ'||op==='NE'){ const e=eq(a,b); res = (op==='EQ')?e:!e; }
    else if (op==='SEQ'||op==='SNE') {
      const e = strictEq(a, b);
      res = (op==='SEQ') ? e : !e;
    }
    else { const an=ensureNum(a), bn=ensureNum(b);
      res = ({LT:an<bn, LE:an<=bn, GT:an>bn, GE:an>=bn})[op];
    }
    stack.push({type:'bool', value: !!res});
  }

  function protoLookup(proto, prop) {
    for (let p=proto; p; p=p.proto) {
      if (p.type!=='proto') break;
      if (prop in p.map) return p.map[prop];
    }
    return null;
  }

  // ---- Array instance methods ----
  const ARRAY_METHODS = new Set([
    'push','pop','slice','indexOf','includes','join',
    'shift','unshift','splice','reverse','sort','concat'
  ]);
  if (ArrayProto && ArrayProto.map) {
    for (const m of ARRAY_METHODS) {
      ArrayProto.map[m] = arrayMethodNative(m);
    }
  }
  function strictEq(a,b){
    if (a.type!==b.type) return false;
    if (a.type==='num'||a.type==='bool'||a.type==='str') return a.value===b.value;
    if (a.type==='null'||a.type==='undef') return true;
    return a===b;
  }
  function arrayMethodNative(name) {
    return { type:'native', name:'Array.'+name, arity:null, call:(vm, args, thisObj) => {
      if (!thisObj || thisObj.type!=='arr') panic('Array method called with invalid this');
      const arr = thisObj;
      switch (name) {
        case 'push':
          for (const v of args) arr.items.push(v);
          return {type:'num', value: arr.items.length};
        case 'pop':
          return arr.items.length? arr.items.pop() : {type:'undef'};
        case 'shift':
          return arr.items.length? arr.items.shift() : {type:'undef'};
        case 'unshift':
          for (let i=0;i<args.length;i++) arr.items.splice(i,0,args[i]);
          return {type:'num', value: arr.items.length};
        case 'slice': {
          const len=arr.items.length;
          const toInt=v=> (v==null || v.type==='null'||v.type==='undef')?null : (v.type==='num'? (v.value|0) : panic('slice indices must be numbers'));
          let start=toInt(args[0]), end=toInt(args[1]);
          if (start==null) start=0; if (end==null) end=len;
          if (start<0) start=Math.max(0,len+start); if (end<0) end=Math.max(0,len+end);
          start=Math.min(Math.max(0,start),len); end=Math.min(Math.max(0,end),len);
          return {type:'arr', items: arr.items.slice(start,end)};
        }
        case 'splice': {
          const len=arr.items.length;
          const toInt=v=> (v==null || v.type==='null'||v.type==='undef')?0 : (v.type==='num'? (v.value|0) : panic('splice indices must be numbers'));
          let start = toInt(args[0]);
          if (start < 0) start = Math.max(0, len + start);
          if (start > len) start = len;
          let deleteCount = (args.length >= 2 && args[1].type==='num') ? Math.max(0, args[1].value|0) : (len - start);
          deleteCount = Math.min(deleteCount, len - start);
          const itemsToInsert = args.slice(2);
          const removed = arr.items.splice(start, deleteCount, ...itemsToInsert);
          return { type:'arr', items: removed };
        }
        case 'reverse':
          arr.items.reverse();
          return arr;
        case 'sort': {
          // No comparator callback support (yet).
          if (args[0] && (args[0].type==='func' || args[0].type==='native')) {
            panic('Array.sort comparator callbacks not supported in this sandbox');
          }
          arr.items.sort((a,b) => {
            if (a.type==='num' && b.type==='num') return a.value - b.value;
            const as = vm.toStringV(a), bs = vm.toStringV(b);
            return as < bs ? -1 : as > bs ? 1 : 0;
          });
          return arr;
        }
        case 'concat': {
          const out = [];
          for (const v of arr.items) out.push(v);
          for (const x of args) {
            if (x && x.type==='arr') out.push(...x.items);
            else out.push(x);
          }
          return { type:'arr', items: out };
        }
        case 'indexOf': {
          const search = args[0] ?? {type:'undef'};
          const from = (args[1] && args[1].type==='num') ? (args[1].value|0) : 0;
          for (let i=Math.max(0,from); i<arr.items.length; i++) if (strictEq(arr.items[i], search)) return {type:'num', value:i};
          return {type:'num', value:-1};
        }
        case 'includes': {
          const search = args[0] ?? {type:'undef'};
          const from = (args[1] && args[1].type==='num') ? (args[1].value|0) : 0;
          for (let i=Math.max(0,from); i<arr.items.length; i++) if (strictEq(arr.items[i], search)) return {type:'bool', value:true};
          return {type:'bool', value:false};
        }
        case 'join': {
          const sep = (args[0] && args[0].type==='str') ? args[0].value : ',';
          return {type:'str', value: arr.items.map(vm.toStringV).join(sep)};
        }
      }
      panic('Unknown array method');
    }};
  }

  function makeClosure(funcIndex, env) { const f = functions[funcIndex]; return { type:'func', name:f.name, funcIndex, env }; }

  const homeProtoByFuncIndex = Object.create(null);

  const stack = [];
  const callstack = [];
  const microtasks = [];
  let drainingMicrotasks = false;
  const globals = Env(null);
  for (const k of Object.keys(builtins)) globals.map[k]=builtins[k];

  function enqueueMicrotask(job) {
    if (typeof job !== 'function') {
      throw new TypeError('Microtask must be a function');
    }
    microtasks.push(job);
  }

  function runMicrotasks() {
    if (drainingMicrotasks) return 0;
    drainingMicrotasks = true;
    let ran = 0;
    try {
      while (microtasks.length > 0) {
        if (ran >= microtaskLimit) {
          panic(`Microtask queue limit exceeded (${microtaskLimit})`);
        }
        const job = microtasks.shift();
        job();
        ran++;
      }
      return ran;
    } finally {
      drainingMicrotasks = false;
    }
  }

  function isCallable(v) {
    return !!v && (v.type === 'native' || v.type === 'func');
  }

  function boxError(err) {
    return { type:'str', value: String(err?.message ?? err) };
  }

  function callPromiseHandler(fnValue, args, thisObj = null) {
    if (!fnValue) throw new Error('Promise reaction callback is missing');
    if (fnValue.type === 'native') {
      return fnValue.call(vm, args, thisObj) ?? { type:'null' };
    }
    if (fnValue.type === 'func') {
      pushFrame(fnValue, args, thisObj, {});
      return vm.runMain();
    }
    throw new Error('Promise reaction callback must be callable');
  }

  function isPromise(v) {
    return !!v && v.type === 'promise';
  }

  function cleanupFrameStack(frame) {
    if (typeof frame?.stackBase !== 'number') return;
    if (stack.length > frame.stackBase) {
      stack.length = frame.stackBase;
    }
  }

  function resumeAsyncFrame(frame, ok, value) {
    if (!frame || !frame.asyncFunction) return;
    if (frame.awaiting !== true) return;
    frame.awaiting = false;
    frame.resumeRecord = { ok, value };
    const saved = frame.savedStack ?? [];
    frame.savedStack = null;
    frame.stackBase = stack.length;
    for (const v of saved) stack.push(v);
    callstack.push(frame);
  }

  function createPromiseValue() {
    return {
      type:'promise',
      state:'pending',
      value:{ type:'undef' },
      fulfillReactions:[],
      rejectReactions:[],
      proto: PromiseProto,
    };
  }

  function settlePromise(promise, state, value) {
    if (!promise || promise.type !== 'promise') panic('Attempted to settle non-promise value');
    if (promise.state !== 'pending') return;
    promise.state = state;
    promise.value = value;

    const reactions = state === 'fulfilled' ? promise.fulfillReactions : promise.rejectReactions;
    for (const reaction of reactions) {
      enqueueMicrotask(() => runPromiseReaction(reaction, state, value));
    }
    promise.fulfillReactions = [];
    promise.rejectReactions = [];
  }

  function resolvePromise(promise, value) {
    if (promise === value) {
      settlePromise(promise, 'rejected', { type:'str', value:'TypeError: Promise cannot resolve with itself' });
      return;
    }
    if (value && value.type === 'promise') {
      if (value.state === 'pending') {
        value.fulfillReactions.push({ next: promise, onFulfilled: null, onRejected: null });
        value.rejectReactions.push({ next: promise, onFulfilled: null, onRejected: null });
      } else {
        enqueueMicrotask(() => {
          if (value.state === 'fulfilled') settlePromise(promise, 'fulfilled', value.value);
          else settlePromise(promise, 'rejected', value.value);
        });
      }
      return;
    }
    settlePromise(promise, 'fulfilled', value);
  }

  function rejectPromise(promise, reason) {
    settlePromise(promise, 'rejected', reason);
  }

  function runPromiseReaction(reaction, state, value) {
    if (reaction.kind === 'finally') {
      const next = reaction.next;
      const onFinally = reaction.onFinally;

      if (!onFinally) {
        if (state === 'fulfilled') resolvePromise(next, value);
        else rejectPromise(next, value);
        return;
      }

      try {
        const out = callPromiseHandler(onFinally, [], null);
        if (isPromise(out)) {
          const passThrough = {
            type:'native',
            name:'Promise.finally.passThrough',
            arity:1,
            call: (vm2) => {
              if (state === 'fulfilled') vm2.promiseResolve(next, value);
              else vm2.promiseReject(next, value);
              return { type:'null' };
            },
          };
          const rejectFromFinally = {
            type:'native',
            name:'Promise.finally.rejectFromFinally',
            arity:1,
            call: (vm2, args) => {
              vm2.promiseReject(next, args[0] ?? { type:'undef' });
              return { type:'null' };
            },
          };
          thenPromise(out, passThrough, rejectFromFinally);
        } else {
          if (state === 'fulfilled') resolvePromise(next, value);
          else rejectPromise(next, value);
        }
      } catch (err) {
        rejectPromise(next, boxError(err));
      }
      return;
    }

    const handler = state === 'fulfilled' ? reaction.onFulfilled : reaction.onRejected;
    const next = reaction.next;

    if (!handler) {
      if (state === 'fulfilled') resolvePromise(next, value);
      else rejectPromise(next, value);
      return;
    }

    try {
      const out = callPromiseHandler(handler, [value], null);
      resolvePromise(next, out ?? { type:'null' });
    } catch (err) {
      rejectPromise(next, boxError(err));
    }
  }

  function thenPromise(promise, onFulfilled, onRejected) {
    if (!promise || promise.type !== 'promise') panic('Promise.then called on non-promise value');
    const next = createPromiseValue();
    const reaction = {
      next,
      onFulfilled: isCallable(onFulfilled) ? onFulfilled : null,
      onRejected: isCallable(onRejected) ? onRejected : null,
    };

    if (promise.state === 'pending') {
      promise.fulfillReactions.push(reaction);
      promise.rejectReactions.push(reaction);
    } else {
      enqueueMicrotask(() => runPromiseReaction(reaction, promise.state, promise.value));
    }
    return next;
  }

  function finallyPromise(promise, onFinally) {
    if (!promise || promise.type !== 'promise') panic('Promise.finally called on non-promise value');
    const next = createPromiseValue();
    const reaction = {
      kind: 'finally',
      next,
      onFinally: isCallable(onFinally) ? onFinally : null,
    };

    if (promise.state === 'pending') {
      promise.fulfillReactions.push(reaction);
      promise.rejectReactions.push(reaction);
    } else {
      enqueueMicrotask(() => runPromiseReaction(reaction, promise.state, promise.value));
    }
    return next;
  }

  function pushFrame(funcValue, args, thisObj=null, flags={}) {
    if (funcValue.type==='native') {
      const r = funcValue.call(vm, args, thisObj);
      stack.push(r ?? {type:'null'});
      return;
    }
    if (funcValue.type!=='func') panic('Attempt to call non-function: '+funcValue.type);
    const f = functions[funcValue.funcIndex];
    const env = Env(funcValue.env);
    for (let i=0;i<f.params.length;i++) envDefine(env, f.params[i], args[i] ?? {type:'null'});
    if (funcValue.bindName) {
      envDefineConst(env, funcValue.bindName, funcValue);
    }
    const effectiveThis = funcValue.lexThis !== undefined ? funcValue.lexThis : thisObj;
    callstack.push({
      funcIndex: funcValue.funcIndex,
      ip:0,
      env,
      thisObj: effectiveThis,
      isCtor: !!flags.isCtor,
      isDerived: !!flags.isDerived,
      superCalled: !!flags.superCalled,
      stackBase: stack.length,
      asyncFunction: !!flags.asyncFunction,
      asyncResult: flags.asyncResult ?? null,
      awaiting: false,
      savedStack: null,
      resumeRecord: null,
      settled: false,
    });
  }
  function popFrame(){ return callstack.pop(); }

  function scopePush(frame) {
    frame.env = Env(frame.env);
  }
  function scopePop(frame) {
    if (!frame.env?.parent) panic('SCOPE_POP without parent env');
    frame.env = frame.env.parent;
  }

  function makeClass(classIndex, env) {
    const meta = classes[classIndex];
    let superClass = null;
    if (meta.superName) {
      const v = envGet(env, meta.superName);
      if (!v || v.type!=='class') panic(`'${meta.name}' extends non-class '${meta.superName}'`);
      superClass = v;
    }
      const proto = { type:'proto', map:Object.create(null), proto: superClass ? superClass.proto : ObjectProto };
    const ctor = meta.ctorIndex != null ? makeClosure(meta.ctorIndex, env) : null;
    const cls = { type:'class', name: meta.name, ctor, proto, super: superClass };
    for (const m of meta.methods) {
      const clos = makeClosure(m.funcIndex, env);
      proto.map[m.name] = clos;
      homeProtoByFuncIndex[m.funcIndex] = proto;
    }
    if (meta.ctorIndex != null) homeProtoByFuncIndex[meta.ctorIndex] = proto;
    return cls;
  }
  function makeInstance(cls) { return { type:'instance', cls, fields:Object.create(null), proto: cls.proto }; }

  // ---- Property operations ----
  function getPropValue(recv, prop) {
    if (recv.type==='arr') {
      if (prop==='length') return {type:'num', value: recv.items.length};
      if (ARRAY_METHODS.has(prop)) return arrayMethodNative(prop);
      const m = protoLookup(recv.proto, prop);
      if (m) return m;
      panic("Unknown array property: " + prop);
    }
    if (recv.type==='str') {
      if (prop==='length') return { type:'num', value: recv.value.length };
      const m = protoLookup(StringProto, prop);
      return m ?? { type:'undef' };
    }
    if (recv.type==='num') {
      if (NumberProtoMethods) {
        if (prop === 'toString') return NumberProtoMethods.toString;
        if (prop === 'valueOf') return NumberProtoMethods.valueOf;
      }
      const m = NumberProto ? protoLookup(NumberProto, prop) : null;
      return m ?? { type:'undef' };
    }
    if (recv.type==='instance') {
      if (hasOwn(recv.fields, prop)) return recv.fields[prop];
      const inner = recv.fields?.__value;
      if (inner) {
        if (inner.type === 'num') {
          if (NumberProtoMethods) {
            if (prop === 'toString') return NumberProtoMethods.toString;
            if (prop === 'valueOf') return NumberProtoMethods.valueOf;
          }
        }
        if (inner.type === 'str') {
          const m = protoLookup(StringProto, prop);
          if (m) return m;
        }
        if (inner.type === 'arr') {
          const m = protoLookup(ArrayProto, prop);
          if (m) return m;
        }
      }
      let p = recv.proto;
      if (!p && inner) {
        if (inner.type === 'str') p = StringProto;
        else if (inner.type === 'num') p = NumberProto;
        else if (inner.type === 'arr') p = ArrayProto;
        else if (inner.type === 'obj') p = ObjectProto;
      }
      const m = p ? protoLookup(p, prop) : null;
      if (m) return m;
      return {type:'undef'};
    }
    if (recv.type==='obj') {
      if (prop in recv.map) return recv.map[prop];
      if (recv.proto) {
        const m = protoLookup(recv.proto, prop);
        if (m) return m;
      }
      return {type:'undef'};
    }
    if (recv.type==='proto') {
      if (prop in recv.map) return recv.map[prop];
      const m = protoLookup(recv.proto, prop);
      return m ?? {type:'undef'};
    }
    if (recv.type==='native' && recv.map) {
      return (prop in recv.map) ? recv.map[prop] : {type:'undef'};
    }
    if (recv.type==='promise') {
      const m = PromiseProto ? protoLookup(PromiseProto, prop) : null;
      return m ?? {type:'undef'};
    }
    panic('GET_PROP on unsupported type: ' + recv.type);
  }
  function setPropValue(recv, prop, value) {
    if (recv.type==='arr') {
      if (prop==='length' || ARRAY_METHODS.has(prop)) panic("Cannot assign to read-only array property: " + prop);
      panic("Unknown array property: " + prop);
    }
    if (recv.type==='instance') { recv.fields[prop]=value; return; }
    if (recv.type==='obj') { recv.map[prop]=value; return; }
    panic('SET_PROP on unsupported type: ' + recv.type);
  }
  function getElemValue(recv, key) {
    if (recv.type==='arr') {
      if (key.type==='str' && key.value==='length') return {type:'num', value: recv.items.length};
      const idx = ensureIndex(key);
      return (idx < recv.items.length) ? recv.items[idx] : {type:'undef'};
    }
    if (recv.type==='obj') {
      const prop = keyToString(key);
      return (prop in recv.map) ? recv.map[prop] : {type:'undef'};
    }
    if (recv.type==='instance') {
      const prop = keyToString(key);
      if (hasOwn(recv.fields, prop)) return recv.fields[prop];
      const m = protoLookup(recv.proto, prop);
      return m ?? {type:'undef'};
    }
    panic('GET_ELEM on unsupported type: ' + recv.type);
  }
  function setElemValue(recv, key, value) {
    if (recv.type==='arr') {
      const idx = ensureIndex(key);
      while (recv.items.length < idx) recv.items.push({type:'undef'});
      recv.items[idx] = value; return;
    }
    if (recv.type==='obj') { recv.map[keyToString(key)] = value; return; }
    if (recv.type==='instance') { recv.fields[keyToString(key)] = value; return; }
    panic('SET_ELEM on unsupported type: ' + recv.type);
  }

  function iterItemsForIn(v) {
    if (v.type === 'arr') {
      const out = [];
      for (let i = 0; i < v.items.length; i++) out.push({ type:'str', value: String(i) });
      return out;
    }
    if (v.type === 'obj') {
      return Object.keys(v.map).map(k => ({ type:'str', value: k }));
    }
    if (v.type === 'instance') {
      return Object.keys(v.fields).map(k => ({ type:'str', value: k }));
    }
    if (v.type === 'str') {
      const out = [];
      for (let i = 0; i < v.value.length; i++) out.push({ type:'str', value: String(i) });
      return out;
    }
    panic('for..in expects object-like value, got ' + v.type);
  }

  function iterItemsForOf(v) {
    if (v.type === 'arr') return v.items.slice();
    if (v.type === 'obj') return Object.keys(v.map).map(k => v.map[k]);
    if (v.type === 'instance') return Object.keys(v.fields).map(k => v.fields[k]);
    if (v.type === 'str') return v.value.split('').map(ch => ({ type:'str', value: ch }));
    panic('for..of expects iterable value, got ' + v.type);
  }

  // ---- VM core loop ----
  const vm = {
    toStringV,
    enqueueMicrotask,
    runMicrotasks,
    createPromise: createPromiseValue,
    promiseResolve: resolvePromise,
    promiseReject: rejectPromise,
    promiseThen: thenPromise,
    promiseFinally: finallyPromise,
    runMain() {
      if (callstack.length === 0) {
        const main = makeClosure(0, globals);
        pushFrame(main, []);
      }
      while (true) {
        while (callstack.length>0) {
          const frame = callstack[callstack.length-1];
          try {
          if (frame.resumeRecord) {
            const rr = frame.resumeRecord;
            frame.resumeRecord = null;
            if (!rr.ok) {
              cleanupFrameStack(frame);
              popFrame();
              if (!frame.settled) {
                frame.settled = true;
                rejectPromise(frame.asyncResult, rr.value ?? { type:'undef' });
              }
              continue;
            }
            stack.push(rr.value ?? { type:'undef' });
          }

          const f = functions[frame.funcIndex];
          const instr = f.code[frame.ip++];
          if (!instr) { stack.push({type:'null'}); popFrame(); continue; }
          setLastInstr({
            text: formatInstr(f, instr, frame.ip-1),
            loc: instr.loc ?? null,
          });

            switch (instr.op) {
          case 'CONST': {
            const v = hydrateConst(consts[instr.a]);
            if (!v) panic('Invalid const pool index: ' + String(instr.a));
            stack.push(cloneValue(v));
            break;
          }
          case 'POP': stack.pop(); break;
          case 'DUP': stack.push(stack[stack.length-1]); break;

          case 'BIND_FUNC_NAME': {
            const v = stack[stack.length - 1];
            if (!v || v.type !== 'func') panic('BIND_FUNC_NAME on non-function');
            v.bindName = String(instr.a);
            break;
          }

          case 'CAPTURE_THIS': {
            const v = stack[stack.length - 1];
            if (!v || v.type !== 'func') panic('CAPTURE_THIS on non-function');
            // Lexically capture the current frame's `this` value.
            v.lexThis = frame.thisObj ?? null;
            break;
          }

          case 'LOAD_NAME': stack.push(envGet(frame.env, instr.a)); break;
          case 'STORE_NAME': { const val = stack[stack.length-1]; envSet(frame.env, instr.a, val); break; }
          case 'DEFINE_NAME': { const val = stack.pop(); envDefine(frame.env, instr.a, val); break; }
          case 'DEFINE_CONST': { const val = stack.pop(); envDefineConst(frame.env, instr.a, val); break; }

          case 'SCOPE_PUSH': scopePush(frame); break;
          case 'SCOPE_POP': scopePop(frame); break;

          case 'LOAD_THIS': {
            if (frame.isCtor && frame.isDerived && !frame.superCalled) panic("Cannot access 'this' before calling super()");
            const t = frame.thisObj ?? {type:'undef'};
            stack.push(t);
            break;
          }

          case 'MAKE_FUNCTION': stack.push(makeClosure(instr.a, frame.env)); break;

          case 'CALL': {
            const argc = instr.a;
            const args = new Array(argc);
            for (let k=argc-1;k>=0;k--) args[k]=stack.pop();
            const callee = stack.pop();
            if (callee.type!=='func' && callee.type!=='native') panic('Attempt to call a non-function value: ' + callee.type);
            if (callee.type === 'func' && functions[callee.funcIndex]?.async) {
              const p = createPromiseValue();
              stack.push(p);
              pushFrame(callee, args, /*this*/null, { asyncFunction:true, asyncResult:p });
            } else {
              pushFrame(callee, args, /*this*/null, {});
            }
            break;
          }

          case 'CALL_PROP': {
            const argc = instr.a;
            const args = new Array(argc);
            for (let k=argc-1;k>=0;k--) args[k]=stack.pop();
            const key = stack.pop();
            const recv = stack.pop();
            const prop = keyToString(key);
            const callee = getPropValue(recv, prop);
            if (callee.type!=='func' && callee.type!=='native') panic('Attempt to call non-function property: ' + prop);
            if (callee.type === 'func' && functions[callee.funcIndex]?.async) {
              const p = createPromiseValue();
              stack.push(p);
              pushFrame(callee, args, recv, { asyncFunction:true, asyncResult:p });
            } else {
              pushFrame(callee, args, recv, {});
            }
            break;
          }

          case 'CALL_ELEM': {
            const argc = instr.a;
            const args = new Array(argc);
            for (let k=argc-1;k>=0;k--) args[k]=stack.pop();
            const key = stack.pop();
            const recv = stack.pop();
            const callee = getElemValue(recv, key);
            if (callee.type!=='func' && callee.type!=='native') panic('Attempt to call non-function element');
            if (callee.type === 'func' && functions[callee.funcIndex]?.async) {
              const p = createPromiseValue();
              stack.push(p);
              pushFrame(callee, args, recv, { asyncFunction:true, asyncResult:p });
            } else {
              pushFrame(callee, args, recv, {});
            }
            break;
          }

          case 'OPT_CHAIN_PROP': {
            const key = stack.pop();
            const recv = stack.pop();
            if (recv.type === 'null' || recv.type === 'undef') {
              stack.push({ type: 'undef' });
            } else {
              const prop = keyToString(key);
              const val = getPropValue(recv, prop);
              stack.push(val);
            }
            break;
          }
          case 'OPT_CHAIN_ELEM': {
            const key = stack.pop();
            const recv = stack.pop();
            if (recv.type === 'null' || recv.type === 'undef') {
              stack.push({ type: 'undef' });
            } else {
              const val = getElemValue(recv, key);
              stack.push(val);
            }
            break;
          }
          case 'OPT_CHAIN_CALL': {
            const argc = instr.a;
            const args = new Array(argc);
            for (let k = argc - 1; k >= 0; k--) args[k] = stack.pop();
            const callee = stack.pop();
            if (callee.type === 'null' || callee.type === 'undef') {
              stack.push({ type: 'undef' });
            } else {
              if (callee.type !== 'func' && callee.type !== 'native') panic('Attempt to call non-function value via optional chain: ' + callee.type);
              pushFrame(callee, args, null, {});
            }
            break;
          }

          case 'CALL_SUPER_CTOR': {
            const argc = instr.a;
            const args = new Array(argc);
            for (let k=argc-1;k>=0;k--) args[k]=stack.pop();
            if (!frame.isCtor) panic("super() used outside of constructor");
            const inst = frame.thisObj;
            const cls = inst?.cls;
            if (!cls || !cls.super) panic("Class has no super to call");
            if (frame.superCalled) panic("super() called multiple times");
            const superCtor = cls.super.ctor;
            frame.superCalled = true;
            if (superCtor) pushFrame(superCtor, args, inst, { isCtor:true, isDerived:false, superCalled:true });
            break;
          }

          case 'CALL_SUPER_METHOD': {
            const methodName = instr.a; const argc = instr.b;
            const args = new Array(argc);
            for (let k=argc-1;k>=0;k--) args[k]=stack.pop();
            const homeProto = homeProtoByFuncIndex[frame.funcIndex];
            if (!homeProto) panic("super.method used outside of a class method");
            const parentProto = homeProto.proto;
            if (!parentProto) panic("No super class for this method");
            const callee = protoLookup(parentProto, methodName);
            if (!callee) panic(`Super method '${methodName}' not found`);
            pushFrame(callee, args, frame.thisObj, {});
            break;
          }

          case 'RET': {
            const ret = stack.pop();
            const finished = popFrame();
            if (finished?.asyncFunction) {
              cleanupFrameStack(finished);
              if (!finished.settled) {
                finished.settled = true;
                resolvePromise(finished.asyncResult, ret ?? {type:'null'});
              }
            } else if (finished?.isCtor) {
              if (finished.isDerived && !finished.superCalled) panic("Derived constructor must call super()");
              stack.push(isObjectLike(ret) ? ret : (finished.thisObj ?? {type:'undef'}));
            } else {
              stack.push(ret ?? {type:'null'});
            }
            break;
          }

          case 'AWAIT': {
            if (!frame.asyncFunction) panic("'await' in non-async frame");
            const awaited = stack.pop() ?? { type:'undef' };

            // Await always resumes asynchronously via microtask, including
            // plain values and already-settled promises.
            frame.awaiting = true;
            frame.savedStack = stack.splice(frame.stackBase);
            popFrame();

            if (!isPromise(awaited)) {
              enqueueMicrotask(() => resumeAsyncFrame(frame, true, awaited));
              break;
            }

            if (awaited.state === 'fulfilled') {
              enqueueMicrotask(() => resumeAsyncFrame(frame, true, awaited.value));
              break;
            }
            if (awaited.state === 'rejected') {
              enqueueMicrotask(() => resumeAsyncFrame(frame, false, awaited.value));
              break;
            }

            const onFulfilled = {
              type:'native',
              name:'await.onFulfilled',
              arity:1,
              call: (vm2, a) => {
                resumeAsyncFrame(frame, true, a[0] ?? { type:'undef' });
                return { type:'null' };
              },
            };
            const onRejected = {
              type:'native',
              name:'await.onRejected',
              arity:1,
              call: (vm2, a) => {
                resumeAsyncFrame(frame, false, a[0] ?? { type:'undef' });
                return { type:'null' };
              },
            };
            thenPromise(awaited, onFulfilled, onRejected);
            break;
          }

          case 'JMP': frame.ip = instr.a; break;
          case 'JMP_IF_FALSE': { const v = stack[stack.length-1]; if (!isTruthy(v)) frame.ip = instr.a; break; }
          case 'JMP_IF_TRUE':  { const v = stack[stack.length-1]; if (isTruthy(v))  frame.ip = instr.a; break; }

          case 'NOT': { const v=stack.pop(); stack.push({type:'bool', value: !isTruthy(v)}); break; }
          case 'NEG': { const v=ensureNum(stack.pop()); stack.push({type:'num', value: -v}); break; }
          case 'TYPEOF': {
            const v = stack.pop();
            let t;
            switch (v?.type) {
              case 'num': t = 'num'; break;
              case 'bool': t = 'bool'; break;
              case 'str': t = 'str'; break;
              case 'null': t = 'null'; break;
              case 'undef': t = 'undef'; break;
              case 'arr': t = 'arr'; break;
              case 'obj': t = 'obj'; break;
              case 'func': t = 'func'; break;
              case 'native': t = 'native'; break;
              case 'class': t = 'class'; break;
              case 'instance': t = 'instance'; break;
              case 'promise': t = 'promise'; break;
              default: t = 'undef';
            }
            stack.push({ type: 'str', value: t });
            break;
          }

          case 'ADD': case 'SUB': case 'MUL': case 'DIV': case 'MOD': binaryMath(instr.op); break;
          case 'LT': case 'LE': case 'GT': case 'GE':
          case 'EQ': case 'NE':
          case 'SEQ': case 'SNE':
            binaryCmp(instr.op);
            break;

          case 'MAKE_OBJ': stack.push({type:'obj', map:Object.create(null), proto: ObjectProto}); break;
          case 'GET_PROP': {
            const key = stack.pop(); const recv = stack.pop(); const prop = keyToString(key);
            const val = getPropValue(recv, prop);
            stack.push(val);
            break;
          }
          case 'SET_PROP': {
            const value = stack.pop(); const key = stack.pop(); const recv = stack.pop();
            setPropValue(recv, keyToString(key), value);
            stack.push(value); break;
          }

          case 'MAKE_ARR': stack.push({type:'arr', items:[], proto: ArrayProto}); break;
          case 'APPEND_ELEM': {
            const value = stack.pop(); const arr = stack.pop();
            if (arr.type!=='arr') panic('APPEND_ELEM on non-array: '+arr.type);
            arr.items.push(value); stack.push(value); break;
          }
          case 'GET_ELEM': {
            const key = stack.pop(); const recv = stack.pop();
            const val = getElemValue(recv, key);
            stack.push(val); break;
          }
          case 'SET_ELEM': {
            const value = stack.pop(); const key = stack.pop(); const recv = stack.pop();
            setElemValue(recv, key, value); stack.push(value); break;
          }

          case 'ITER_INIT_IN': {
            const recv = stack.pop();
            stack.push({ type:'iter', items: iterItemsForIn(recv), index: 0 });
            break;
          }
          case 'ITER_INIT_OF': {
            const recv = stack.pop();
            stack.push({ type:'iter', items: iterItemsForOf(recv), index: 0 });
            break;
          }
          case 'ITER_HAS_NEXT': {
            const iter = stack[stack.length - 1];
            if (!iter || iter.type !== 'iter') panic('ITER_HAS_NEXT on non-iterator');
            stack.push({ type:'bool', value: iter.index < iter.items.length });
            break;
          }
          case 'ITER_GET_NEXT': {
            const iter = stack[stack.length - 1];
            if (!iter || iter.type !== 'iter') panic('ITER_GET_NEXT on non-iterator');
            if (iter.index >= iter.items.length) panic('ITER_GET_NEXT out of bounds');
            stack.push(iter.items[iter.index++]);
            break;
          }

          case 'MAKE_CLASS': { const cls = makeClass(instr.a, frame.env); stack.push(cls); break; }
          case 'NEW': {
            const argc = instr.a;
            const args = new Array(argc);
            for (let k=argc-1;k>=0;k--) args[k]=stack.pop();
            const ctor = stack.pop();
            if (ctor.type === 'class') {
              const inst = makeInstance(ctor);
              if (ctor.ctor) {
                const isDerived = !!ctor.super;
                pushFrame(ctor.ctor, args, inst, { isCtor:true, isDerived, superCalled: !isDerived });
              } else {
                stack.push(inst);
              }
              break;
            }
            if (ctor.type === 'native') {
              // Handle built-in native constructors
              switch (ctor.name) {
                case 'Array': {
                  const arr = ctor.call(vm, args, null);
                  stack.push(arr);
                  break;
                }
                case 'Object': {
                  const res = ctor.call(vm, args, null);
                  stack.push(res);
                  break;
                }
                case 'String': {
                  const s = ctor.call(vm, args, null);
                  const fields = Object.create(null);
                  fields.__value = s;
                  const inst = { type: 'instance', cls: null, fields, proto: StringProto };
                  stack.push(inst);
                  break;
                }
                case 'Number': {
                  const n = ctor.call(vm, args, null);
                  const fields = Object.create(null);
                  fields.__value = n;
                  const inst = { type: 'instance', cls: null, fields, proto: NumberProto };
                  stack.push(inst);
                  break;
                }
                case 'Promise': {
                  const p = ctor.call(vm, args, null);
                  stack.push(p);
                  break;
                }
                default:
                  panic('Attempt to instantiate non-class: ' + ctor.name);
              }
              break;
            }
            panic('Attempt to instantiate non-class: ' + ctor.type);
          }

          case 'NULLISH_COALESCE': {
            const right = stack.pop();
            const left = stack.pop();
            // DEBUG: print left/right
            if (typeof process !== 'undefined' && process.env && process.env.DEBUG_JSVM_NULLISH) {
              process.stderr.write(`[NULLISH] left=${JSON.stringify(left)} right=${JSON.stringify(right)}\n`);
            }
            if (left.type === 'null' || left.type === 'undef') {
              if (typeof process !== 'undefined' && process.env && process.env.DEBUG_JSVM_NULLISH) {
                process.stderr.write(`[NULLISH] push right: ${JSON.stringify(right)}\n`);
              }
              stack.push(right);
            } else {
              if (typeof process !== 'undefined' && process.env && process.env.DEBUG_JSVM_NULLISH) {
                process.stderr.write(`[NULLISH] push left: ${JSON.stringify(left)}\n`);
              }
              stack.push(left);
            }
            break;
          }
          default: panic('Unknown opcode: ' + instr.op);
            }
          } catch (err) {
            let rejectedAsync = false;
            while (callstack.length > 0) {
              const top = callstack[callstack.length - 1];
              cleanupFrameStack(top);
              popFrame();
              if (top.asyncFunction && !top.settled) {
                top.settled = true;
                rejectPromise(top.asyncResult, boxError(err));
                rejectedAsync = true;
                break;
              }
            }
            if (rejectedAsync) continue;
            throw err;
          }
        }

        const ran = runMicrotasks();
        if (callstack.length === 0 && ran === 0) break;
      }
      return stack.pop();
    },
  };

  function cloneValue(v) {
    if (v.type==='num'||v.type==='bool') return {type:v.type, value:v.value};
    if (v.type==='null') return {type:'null'};
    if (v.type==='undef') return {type:'undef'};
    if (v.type==='str') return {type:'str', value:v.value};
    if (v.type==='obj') { const o={type:'obj', map:Object.create(null), proto:v.proto??null}; for (const k of Object.keys(v.map)) o.map[k]=v.map[k]; return o; }
    if (v.type==='arr') { return {type:'arr', items:v.items.slice(), proto:v.proto??ArrayProto}; }
    return v; // classes/instances/functions/natives/instances are identity
  }

  return vm;
}
