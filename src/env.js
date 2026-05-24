// Environment factory for jsvm: creates prototypes and builtins
import { panic } from './common.js';

export function createDefaultEnv({ onPrint }) {
  // Prototypes
  const ObjectProto = { type: 'proto', map: Object.create(null), proto: null };
  const StringProto = { type: 'proto', map: Object.create(null), proto: null };
  const NumberProto = { type: 'proto', map: Object.create(null), proto: null };
  const ArrayProto = { type: 'proto', map: Object.create(null), proto: null };
  const PromiseProto = { type: 'proto', map: Object.create(null), proto: null };

  // Object prototype methods
  ObjectProto.map.toString = {
    type: 'native', name: 'Object.prototype.toString', arity: 0,
    call: () => ({ type: 'str', value: '[object Object]' })
  };

  // String prototype methods
  function stringValue(thisObj) {
    if (!thisObj) return '';
    if (thisObj.type === 'str') return thisObj.value;
    if (thisObj.type === 'instance' && thisObj.fields && thisObj.proto === StringProto) {
      const v = thisObj.fields.__value;
      return v && v.type === 'str' ? v.value : '';
    }
    return '';
  }
  StringProto.map.toUpperCase = {
    type: 'native', name: 'String.prototype.toUpperCase', arity: 0,
    call: (vm, args, thisObj) => ({ type: 'str', value: stringValue(thisObj).toUpperCase() })
  };
  StringProto.map.toLowerCase = {
    type: 'native', name: 'String.prototype.toLowerCase', arity: 0,
    call: (vm, args, thisObj) => ({ type: 'str', value: stringValue(thisObj).toLowerCase() })
  };
  StringProto.map.charAt = {
    type: 'native', name: 'String.prototype.charAt', arity: 1,
    call: (vm, args, thisObj) => {
      const s = stringValue(thisObj);
      const idx = (args[0] && args[0].type === 'num') ? args[0].value | 0 : 0;
      const ch = (idx >= 0 && idx < s.length) ? s[idx] : '';
      return { type: 'str', value: ch };
    }
  };

  // Number prototype methods
  function numberValue(thisObj) {
    if (!thisObj) return NaN;
    if (thisObj.type === 'num') return thisObj.value;
    if (thisObj.type === 'instance' && thisObj.fields && thisObj.proto === NumberProto) {
      const v = thisObj.fields.__value;
      return v && v.type === 'num' ? v.value : NaN;
    }
    return NaN;
  }
  const NumberProtoMethods = {
    toString: {
      type: 'native', name: 'Number.prototype.toString', arity: 0,
      call: (vm, args, thisObj) => ({ type: 'str', value: String(numberValue(thisObj)) })
    },
    valueOf: {
      type: 'native', name: 'Number.prototype.valueOf', arity: 0,
      call: (vm, args, thisObj) => ({ type: 'num', value: numberValue(thisObj) })
    },
  };
  NumberProto.map.toString = NumberProtoMethods.toString;
  NumberProto.map.valueOf = NumberProtoMethods.valueOf;

  PromiseProto.map.then = {
    type: 'native', name: 'Promise.prototype.then', arity: 2,
    call: (vm, args, thisObj) => {
      if (!thisObj || thisObj.type !== 'promise') panic('Promise.then called with invalid this');
      const onFulfilled = args[0] ?? null;
      const onRejected = args[1] ?? null;
      return vm.promiseThen(thisObj, onFulfilled, onRejected);
    }
  };
  PromiseProto.map.catch = {
    type: 'native', name: 'Promise.prototype.catch', arity: 1,
    call: (vm, args, thisObj) => {
      if (!thisObj || thisObj.type !== 'promise') panic('Promise.catch called with invalid this');
      const onRejected = args[0] ?? null;
      return vm.promiseThen(thisObj, null, onRejected);
    }
  };
  PromiseProto.map.finally = {
    type: 'native', name: 'Promise.prototype.finally', arity: 1,
    call: (vm, args, thisObj) => {
      if (!thisObj || thisObj.type !== 'promise') panic('Promise.finally called with invalid this');
      const onFinally = args[0] ?? null;
      return vm.promiseFinally(thisObj, onFinally);
    }
  };

  // Math builtins
  const mathFuncs = [
    ['abs', 1, Math.abs], ['acos', 1, Math.acos], ['acosh', 1, Math.acosh], ['asin', 1, Math.asin], ['asinh', 1, Math.asinh],
    ['atan', 1, Math.atan], ['atan2', 2, Math.atan2], ['atanh', 1, Math.atanh], ['cbrt', 1, Math.cbrt], ['ceil', 1, Math.ceil],
    ['clz32', 1, Math.clz32], ['cos', 1, Math.cos], ['cosh', 1, Math.cosh], ['exp', 1, Math.exp], ['expm1', 1, Math.expm1],
    ['floor', 1, Math.floor], ['fround', 1, Math.fround], ['hypot', null, Math.hypot], ['imul', 2, Math.imul], ['log', 1, Math.log],
    ['log10', 1, Math.log10], ['log1p', 1, Math.log1p], ['log2', 1, Math.log2], ['max', null, Math.max], ['min', null, Math.min],
    ['pow', 2, Math.pow], ['random', 0, Math.random], ['round', 1, Math.round], ['sign', 1, Math.sign], ['sin', 1, Math.sin],
    ['sinh', 1, Math.sinh], ['sqrt', 1, Math.sqrt], ['tan', 1, Math.tan], ['tanh', 1, Math.tanh], ['trunc', 1, Math.trunc],
  ];
  const mathConsts = [
    ['E', Math.E], ['LN10', Math.LN10], ['LN2', Math.LN2], ['LOG10E', Math.LOG10E], ['LOG2E', Math.LOG2E], ['PI', Math.PI], ['SQRT1_2', Math.SQRT1_2], ['SQRT2', Math.SQRT2],
  ];
  const MathObj = { type: 'obj', map: Object.create(null) };
  for (const [name, arity, fn] of mathFuncs) {
    MathObj.map[name] = {
      type: 'native', name: 'Math.' + name, arity,
      call: (vm, args) => {
        const jsArgs = Array.isArray(args) ? args.map(a => a && a.type === 'num' ? a.value : NaN) : [];
        let result;
        try { result = arity === null ? fn(...jsArgs) : fn(...jsArgs.slice(0, arity)); }
        catch { result = NaN; }
        return { type: 'num', value: result };
      }
    };
  }
  for (const [name, value] of mathConsts) MathObj.map[name] = { type: 'num', value };

  // Boxing helpers bound to these prototypes
  function jsToBoxed(val) {
    if (val === null) return { type: 'null' };
    if (val === undefined) return { type: 'undef' };
    if (typeof val === 'number') return { type: 'num', value: val };
    if (typeof val === 'boolean') return { type: 'bool', value: val };
    if (typeof val === 'string') return { type: 'str', value: val };
    if (Array.isArray(val)) return { type: 'arr', items: val.map(jsToBoxed), proto: ArrayProto };
    if (typeof val === 'object') {
      const o = { type: 'obj', map: Object.create(null), proto: ObjectProto };
      for (const k of Object.keys(val)) o.map[k] = jsToBoxed(val[k]);
      return o;
    }
    return { type: 'undef' };
  }
  function boxedToJs(v) {
    if (!v || v.type === 'null') return null;
    if (v.type === 'undef') return undefined;
    if (v.type === 'num' || v.type === 'bool' || v.type === 'str') return v.value;
    if (v.type === 'arr') return v.items.map(boxedToJs);
    if (v.type === 'obj') { const o = {}; for (const k of Object.keys(v.map)) o[k] = boxedToJs(v.map[k]); return o; }
    return undefined;
  }

  function consoleWrite(vm, args) {
    const out = (args ?? []).map(a => vm.toStringV(a ?? { type: 'undef' })).join(' ');
    onPrint?.(out);
    return { type: 'undef' };
  }

  const ConsoleObj = {
    type: 'obj',
    map: {
      log: {
        type: 'native',
        name: 'console.log',
        arity: null,
        call: (vm, args) => consoleWrite(vm, args),
      },
      info: {
        type: 'native',
        name: 'console.info',
        arity: null,
        call: (vm, args) => consoleWrite(vm, args),
      },
      warn: {
        type: 'native',
        name: 'console.warn',
        arity: null,
        call: (vm, args) => consoleWrite(vm, args),
      },
      error: {
        type: 'native',
        name: 'console.error',
        arity: null,
        call: (vm, args) => consoleWrite(vm, args),
      },
    },
  };

  const builtins = {
    print: { type:'native', name:'print', arity:1, call:(vm,args)=>{ const s = vm.toStringV(args[0] ?? {type:'null'}); onPrint?.(s); return {type:'null'}; } },
    console: ConsoleObj,
    Math: MathObj,
    JSON: {
      type: 'obj', map: {
        parse: { type: 'native', name: 'JSON.parse', arity: 1, call: (vm, args) => {
          const str = args[0]?.type === 'str' ? args[0].value : '';
          try { const val = JSON.parse(str); return jsToBoxed(val); } catch { return { type: 'null' }; }
        }},
        stringify: { type: 'native', name: 'JSON.stringify', arity: 1, call: (vm, args) => {
          const val = boxedToJs(args[0]);
          try { return { type: 'str', value: JSON.stringify(val) }; } catch { return { type: 'str', value: '' }; }
        }}
      }
    },
    Object: { type: 'native', name: 'Object', arity: 1, map: { prototype: ObjectProto }, call: (vm, args) => {
      const v = args[0];
      if (!v || v.type === 'null' || v.type === 'undef') return { type: 'obj', map: Object.create(null), proto: ObjectProto };
      if (v.type!=='num' && v.type!=='bool' && v.type!=='str' && v.type!=='null' && v.type!=='undef') return v;
      return { type: 'obj', map: { value: v }, proto: ObjectProto };
    }},
    String: { type: 'native', name: 'String', arity: 1, map: { prototype: StringProto }, call: (vm, args) => {
      const v = args[0] ?? { type: 'undef' }; return { type: 'str', value: vm.toStringV(v) };
    }},
    Number: { type: 'native', name: 'Number', arity: 1, map: { prototype: NumberProto }, call: (vm, args) => {
      const v = args[0]; const num = Number(v?.type === 'num' ? v.value : vm.toStringV(v ?? { type: 'undef' })); return { type: 'num', value: num };
    }},
    Array: { type: 'native', name: 'Array', arity: null, map: { prototype: ArrayProto, isArray: { type: 'native', name: 'Array.isArray', arity: 1, call: (vm, args) => ({ type: 'bool', value: args[0]?.type === 'arr' }) } },
      call: (vm, args) => {
        const items = [];
        if (args.length === 1 && args[0]?.type === 'num') {
          const n = args[0].value; const len = n|0; if (len !== n || len < 0) panic('Invalid array length');
          for (let i = 0; i < len; i++) items.push({ type: 'undef' });
        } else { for (const a of args) items.push(a ?? { type: 'undef' }); }
        return { type: 'arr', items, proto: ArrayProto };
      }
    },
    Promise: {
      type: 'native',
      name: 'Promise',
      arity: 1,
      map: {
        prototype: PromiseProto,
        resolve: {
          type: 'native', name: 'Promise.resolve', arity: 1,
          call: (vm, args) => {
            const v = args[0] ?? { type:'undef' };
            if (v && v.type === 'promise') return v;
            const p = vm.createPromise();
            vm.promiseResolve(p, v);
            return p;
          }
        },
        reject: {
          type: 'native', name: 'Promise.reject', arity: 1,
          call: (vm, args) => {
            const reason = args[0] ?? { type:'undef' };
            const p = vm.createPromise();
            vm.promiseReject(p, reason);
            return p;
          }
        },
      },
      call: (vm, args) => {
        const p = vm.createPromise();
        const executor = args[0];
        if (!executor) {
          vm.promiseReject(p, { type:'str', value:'TypeError: Promise executor is required' });
          return p;
        }
        if (executor.type !== 'native') {
          vm.promiseReject(p, { type:'str', value:'TypeError: Promise executor currently supports native functions only' });
          return p;
        }
        const resolveFn = {
          type:'native', name:'Promise.resolveFn', arity:1,
          call: (vm2, cbArgs) => {
            vm2.promiseResolve(p, cbArgs[0] ?? { type:'undef' });
            return { type:'null' };
          }
        };
        const rejectFn = {
          type:'native', name:'Promise.rejectFn', arity:1,
          call: (vm2, cbArgs) => {
            vm2.promiseReject(p, cbArgs[0] ?? { type:'undef' });
            return { type:'null' };
          }
        };
        try {
          executor.call(vm, [resolveFn, rejectFn], null);
        } catch (err) {
          vm.promiseReject(p, { type:'str', value: String(err?.message ?? err) });
        }
        return p;
      },
    },
  };

  return { builtins, ObjectProto, StringProto, NumberProto, ArrayProto, PromiseProto, NumberProtoMethods };
}
