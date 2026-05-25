import { panic } from './common.js';

// Binary bundle format: JSVB v1
// Little-endian, chunked.
//
// Header:
//   bytes[0..3]  "JSVB"
//   u16          version (1)
//   u16          flags (0)
//
// Chunks:
//   u32 tag
//   u32 byteLen
//   payload[byteLen]
//
// Tags:
//   1 CONSTS
//   2 FUNCTIONS
//   3 CLASSES
//   4 IMPORTS
//   5 EXPORTS
//   6 DEFAULT_EXPORT
//   7 REEXPORTS

const MAGIC = Buffer.from('JSVB');
const VERSION = 1;

const TAG_CONSTS = 1;
const TAG_FUNCTIONS = 2;
const TAG_CLASSES = 3;
const TAG_IMPORTS = 4;
const TAG_EXPORTS = 5;
const TAG_DEFAULT_EXPORT = 6;
const TAG_REEXPORTS = 7;

// Const tags
const C_NULL = 0;
const C_UNDEF = 1;
const C_BOOL = 2;
const C_NUM = 3;
const C_STR = 4;
const C_FUNC = 5;
const C_NATIVE = 6;
const C_PROTO = 7;
const C_ARR = 8;
const C_OBJ = 9;

// Loc is stored as u32 line, u32 col (0/0 means missing)

class Writer {
  constructor() {
    this.parts = [];
    this.size = 0;
  }
  push(buf) {
    this.parts.push(buf);
    this.size += buf.length;
  }
  u8(v) {
    const b = Buffer.allocUnsafe(1);
    b.writeUInt8(v >>> 0, 0);
    this.push(b);
  }
  u16(v) {
    const b = Buffer.allocUnsafe(2);
    b.writeUInt16LE(v >>> 0, 0);
    this.push(b);
  }
  u32(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeUInt32LE(v >>> 0, 0);
    this.push(b);
  }
  i32(v) {
    const b = Buffer.allocUnsafe(4);
    b.writeInt32LE(v | 0, 0);
    this.push(b);
  }
  f64(v) {
    const b = Buffer.allocUnsafe(8);
    b.writeDoubleLE(Number(v), 0);
    this.push(b);
  }
  bytes(buf) {
    this.push(Buffer.from(buf));
  }
  str(s) {
    const b = Buffer.from(String(s), 'utf8');
    this.u32(b.length);
    this.bytes(b);
  }
  finish() {
    return Buffer.concat(this.parts, this.size);
  }
}

class Reader {
  constructor(buf) {
    this.buf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    this.off = 0;
  }
  ensure(n) {
    if (this.off + n > this.buf.length) panic('Truncated bytecode bundle');
  }
  u8() {
    this.ensure(1);
    const v = this.buf.readUInt8(this.off);
    this.off += 1;
    return v;
  }
  u16() {
    this.ensure(2);
    const v = this.buf.readUInt16LE(this.off);
    this.off += 2;
    return v;
  }
  u32() {
    this.ensure(4);
    const v = this.buf.readUInt32LE(this.off);
    this.off += 4;
    return v;
  }
  i32() {
    this.ensure(4);
    const v = this.buf.readInt32LE(this.off);
    this.off += 4;
    return v;
  }
  f64() {
    this.ensure(8);
    const v = this.buf.readDoubleLE(this.off);
    this.off += 8;
    return v;
  }
  bytes(n) {
    this.ensure(n);
    const b = this.buf.subarray(this.off, this.off + n);
    this.off += n;
    return b;
  }
  str() {
    const n = this.u32();
    const b = this.bytes(n);
    return b.toString('utf8');
  }
}

function encodeConstValue(w, c) {
  switch (c?.type) {
    case 'null':
      w.u8(C_NULL);
      break;
    case 'undef':
      w.u8(C_UNDEF);
      break;
    case 'bool':
      w.u8(C_BOOL);
      w.u8(c.value ? 1 : 0);
      break;
    case 'num':
      w.u8(C_NUM);
      w.f64(c.value);
      break;
    case 'str':
      w.u8(C_STR);
      w.str(c.value);
      break;
    case 'func':
      // User functions are runtime closures (captured env), not serializable.
      // Encode by function index so VM can recreate a closure in the right environment.
      w.u8(C_FUNC);
      w.u32(c.funcIndex >>> 0);
      break;
    case 'native':
      // Natives are rehydrated by name at runtime.
      w.u8(C_NATIVE);
      w.str(c.name);
      break;
    case 'proto':
      // Prototypes are runtime objects; they are rehydrated as placeholders.
      w.u8(C_PROTO);
      break;
    case 'arr': {
      w.u8(C_ARR);
      const items = Array.isArray(c.items) ? c.items : [];
      w.u32(items.length);
      for (const item of items) encodeConstValue(w, item);
      break;
    }
    case 'obj': {
      w.u8(C_OBJ);
      const map = c.map ?? Object.create(null);
      const keys = Object.keys(map);
      w.u32(keys.length);
      for (const k of keys) {
        w.str(k);
        encodeConstValue(w, map[k]);
      }
      break;
    }
    default:
      panic('Unsupported const type in encoder: ' + String(c?.type));
  }
}

function encodeConsts(consts) {
  const w = new Writer();
  w.u32(consts.length);
  for (const c of consts) {
    encodeConstValue(w, c);
  }
  return w.finish();
}

function decodeConstValue(r) {
  const tag = r.u8();
  switch (tag) {
    case C_NULL:
      return { type: 'null' };
    case C_UNDEF:
      return { type: 'undef' };
    case C_BOOL:
      return { type: 'bool', value: r.u8() === 1 };
    case C_NUM:
      return { type: 'num', value: r.f64() };
    case C_STR:
      return { type: 'str', value: r.str() };
    case C_FUNC:
      // Stored as function index; VM will rehydrate to a closure at runtime.
      return { type: 'func', funcIndex: r.u32(), name: null, env: null };
    case C_NATIVE:
      return { type: 'native', name: r.str(), arity: null, call: null };
    case C_PROTO:
      return { type: 'proto', map: Object.create(null), proto: null };
    case C_ARR: {
      const count = r.u32();
      const items = [];
      for (let i = 0; i < count; i++) items.push(decodeConstValue(r));
      return { type: 'arr', items };
    }
    case C_OBJ: {
      const count = r.u32();
      const map = Object.create(null);
      for (let i = 0; i < count; i++) {
        const key = r.str();
        map[key] = decodeConstValue(r);
      }
      return { type: 'obj', map, proto: null };
    }
    default:
      panic('Unsupported const tag in decoder: ' + String(tag));
  }
}

function decodeConsts(r) {
  const n = r.u32();
  const consts = [];
  for (let i = 0; i < n; i++) {
    consts.push(decodeConstValue(r));
  }
  return consts;
}

function encodeImports(imports) {
  const w = new Writer();
  w.u32(imports.length);
  for (const imp of imports) {
    w.str(imp.source ?? '');
    const specs = Array.isArray(imp.specifiers) ? imp.specifiers : [];
    w.u32(specs.length);
    for (const spec of specs) {
      w.str(spec.imported ?? '');
      w.str(spec.local ?? '');
    }
  }
  return w.finish();
}

function decodeImports(r) {
  const n = r.u32();
  const imports = [];
  for (let i = 0; i < n; i++) {
    const source = r.str();
    const specCount = r.u32();
    const specifiers = [];
    for (let j = 0; j < specCount; j++) {
      specifiers.push({ imported: r.str(), local: r.str() });
    }
    imports.push({ source, specifiers });
  }
  return imports;
}

function encodeExports(exportsList) {
  const w = new Writer();
  w.u32(exportsList.length);
  for (const exp of exportsList) {
    w.str(exp.exported ?? '');
    w.str(exp.local ?? '');
  }
  return w.finish();
}

function decodeExports(r) {
  const n = r.u32();
  const exportsList = [];
  for (let i = 0; i < n; i++) {
    exportsList.push({ exported: r.str(), local: r.str() });
  }
  return exportsList;
}

function encodeDefaultExport(defaultExport) {
  const w = new Writer();
  if (defaultExport == null) {
    w.u8(0);
  } else {
    w.u8(1);
    w.str(JSON.stringify(defaultExport));
  }
  return w.finish();
}

function decodeDefaultExport(r) {
  const hasDefault = r.u8() === 1;
  if (!hasDefault) return null;
  const raw = r.str();
  try {
    return JSON.parse(raw);
  } catch {
    panic('Malformed bundle: invalid default export payload');
  }
}

function encodeReExports(reExports) {
  const w = new Writer();
  w.u32(reExports.length);
  for (const reExp of reExports) {
    w.str(reExp.source ?? '');
    const specs = Array.isArray(reExp.specifiers) ? reExp.specifiers : [];
    w.u32(specs.length);
    for (const spec of specs) {
      w.str(spec.local ?? '');
      w.str(spec.exported ?? '');
    }
  }
  return w.finish();
}

function decodeReExports(r) {
  const n = r.u32();
  const reExports = [];
  for (let i = 0; i < n; i++) {
    const source = r.str();
    const specCount = r.u32();
    const specifiers = [];
    for (let j = 0; j < specCount; j++) {
      specifiers.push({ local: r.str(), exported: r.str() });
    }
    reExports.push({ source, specifiers });
  }
  return reExports;
}

function encodeFunctions(functions) {
  const w = new Writer();
  w.u32(functions.length);
  for (const f of functions) {
    w.str(f.name);
    w.u32(f.arity >>> 0);
    w.u32(f.params?.length ?? f.arity);
    // Params are only used for debugging today; store names for completeness.
    if (Array.isArray(f.params)) {
      for (const p of f.params) w.str(p);
    } else {
      for (let i = 0; i < (f.arity >>> 0); i++) w.str('');
    }

    w.u32(f.code.length);
    for (const instr of f.code) {
      w.str(instr.op);
      // `a`/`b` can be strings for name-based instructions (e.g. LOAD_NAME).
      // Encode as tagged union: 0=null, 1=i32, 2=str
      if (instr.a == null) {
        w.u8(0);
      } else if (typeof instr.a === 'number') {
        w.u8(1);
        w.i32(instr.a);
      } else {
        w.u8(2);
        w.str(instr.a);
      }

      if (instr.b == null) {
        w.u8(0);
      } else if (typeof instr.b === 'number') {
        w.u8(1);
        w.i32(instr.b);
      } else {
        w.u8(2);
        w.str(instr.b);
      }
      const line = instr.loc?.line ?? 0;
      const col = instr.loc?.col ?? 0;
      w.u32(line >>> 0);
      w.u32(col >>> 0);
    }

    // Encode async flag and awaitSites array
    w.u8(f.async ? 1 : 0);
    const awaits = f.awaitSites ?? [];
    w.u32(awaits.length);
    for (const siteIdx of awaits) {
      w.u32(siteIdx >>> 0);
    }
  }
  return w.finish();
}

function decodeFunctions(r) {
  const n = r.u32();
  const functions = [];
  for (let i = 0; i < n; i++) {
    const name = r.str();
    const arity = r.u32();
    const paramCount = r.u32();
    const params = [];
    for (let p = 0; p < paramCount; p++) params.push(r.str());

    const codeCount = r.u32();
    const code = [];
    for (let j = 0; j < codeCount; j++) {
      const op = r.str();
      const aTag = r.u8();
      const a = aTag === 0 ? null : aTag === 1 ? r.i32() : r.str();
      const bTag = r.u8();
      const b = bTag === 0 ? null : bTag === 1 ? r.i32() : r.str();
      const line = r.u32();
      const col = r.u32();
      code.push({
        op,
        a,
        b,
        loc: line === 0 && col === 0 ? null : { line, col },
      });
    }

    // Decode async flag and awaitSites array
    const async = r.u8() === 1;
    const awaitCount = r.u32();
    const awaitSites = [];
    for (let j = 0; j < awaitCount; j++) {
      awaitSites.push(r.u32());
    }

    functions.push({ name, arity, params, code, async, awaitSites });
  }
  return functions;
}

function encodeClasses(classes) {
  const w = new Writer();
  w.u32(classes.length);
  for (const c of classes) {
    w.str(c.name);
    w.u8(c.superName == null ? 0 : 1);
    if (c.superName != null) w.str(c.superName);

    w.i32(c.ctorIndex == null ? -1 : c.ctorIndex);

    const methods = Array.isArray(c.methods) ? c.methods : [];
    w.u32(methods.length);
    for (const m of methods) {
      w.str(m.name);
      w.u32(m.funcIndex >>> 0);
    }
  }
  return w.finish();
}

function decodeClasses(r) {
  const n = r.u32();
  const classes = [];
  for (let i = 0; i < n; i++) {
    const name = r.str();
    const hasSuper = r.u8() === 1;
    const superName = hasSuper ? r.str() : null;
    const ctorIndexRaw = r.i32();
    const ctorIndex = ctorIndexRaw < 0 ? null : ctorIndexRaw;

    const mcount = r.u32();
    const methods = [];
    for (let j = 0; j < mcount; j++) {
      const mname = r.str();
      const funcIndex = r.u32();
      methods.push({ name: mname, funcIndex });
    }
    classes.push({ name, superName, ctorIndex, methods });
  }
  return classes;
}

function encodeChunk(tag, payloadBuf) {
  const w = new Writer();
  w.u32(tag);
  w.u32(payloadBuf.length);
  w.bytes(payloadBuf);
  return w.finish();
}

export function encodeBundle(bundle) {
  if (bundle?.bytecodeVersion !== 1) {
    panic(`Unsupported bytecodeVersion ${String(bundle?.bytecodeVersion)} (expected 1)`);
  }
  const w = new Writer();
  w.bytes(MAGIC);
  w.u16(VERSION);
  w.u16(0);

  const consts = bundle.consts ?? [];
  const functions = bundle.functions ?? [];
  const classes = bundle.classes ?? [];
  const imports = bundle.imports ?? [];
  const exportsList = bundle.exports ?? [];
  const defaultExport = bundle.defaultExport ?? null;
  const reExports = bundle.reExports ?? [];

  w.bytes(encodeChunk(TAG_CONSTS, encodeConsts(consts)));
  w.bytes(encodeChunk(TAG_FUNCTIONS, encodeFunctions(functions)));
  w.bytes(encodeChunk(TAG_CLASSES, encodeClasses(classes)));
  w.bytes(encodeChunk(TAG_IMPORTS, encodeImports(imports)));
  w.bytes(encodeChunk(TAG_EXPORTS, encodeExports(exportsList)));
  w.bytes(encodeChunk(TAG_DEFAULT_EXPORT, encodeDefaultExport(defaultExport)));
  w.bytes(encodeChunk(TAG_REEXPORTS, encodeReExports(reExports)));

  return w.finish();
}

export function decodeBundle(buf) {
  const r = new Reader(buf);
  const magic = r.bytes(4);
  if (!magic.equals(MAGIC)) panic('Invalid bytecode bundle magic');
  const version = r.u16();
  r.u16(); // flags
  if (version !== VERSION) panic(`Unsupported bundle format version ${version} (expected ${VERSION})`);

  let consts = null;
  let functions = null;
  let classes = null;
  let imports = [];
  let exportsList = [];
  let defaultExport = null;
  let reExports = [];

  while (r.off < r.buf.length) {
    const tag = r.u32();
    const len = r.u32();
    const payload = r.bytes(len);
    const rr = new Reader(payload);
    if (tag === TAG_CONSTS) consts = decodeConsts(rr);
    else if (tag === TAG_FUNCTIONS) functions = decodeFunctions(rr);
    else if (tag === TAG_CLASSES) classes = decodeClasses(rr);
    else if (tag === TAG_IMPORTS) imports = decodeImports(rr);
    else if (tag === TAG_EXPORTS) exportsList = decodeExports(rr);
    else if (tag === TAG_DEFAULT_EXPORT) defaultExport = decodeDefaultExport(rr);
    else if (tag === TAG_REEXPORTS) reExports = decodeReExports(rr);
    else {
      // Unknown chunk tag: skip for forward compatibility.
    }
  }

  if (!consts) panic('Malformed bundle: missing CONSTS chunk');
  if (!functions) panic('Malformed bundle: missing FUNCTIONS chunk');
  if (!classes) panic('Malformed bundle: missing CLASSES chunk');

  return {
    bytecodeVersion: 1,
    consts,
    functions,
    classes,
    imports,
    exports: exportsList,
    defaultExport,
    reExports,
  };
}
