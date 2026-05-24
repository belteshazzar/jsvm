import { panic } from '../core/common.js';

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

const MAGIC = Buffer.from('JSVB');
const VERSION = 1;

const TAG_CONSTS = 1;
const TAG_FUNCTIONS = 2;
const TAG_CLASSES = 3;

// Const tags
const C_NULL = 0;
const C_UNDEF = 1;
const C_BOOL = 2;
const C_NUM = 3;
const C_STR = 4;
const C_FUNC = 5;
const C_NATIVE = 6;
const C_PROTO = 7;

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

function encodeConsts(consts) {
  const w = new Writer();
  w.u32(consts.length);
  for (const c of consts) {
    switch (c.type) {
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
        // Payload: u32 funcIndex
        w.u8(C_FUNC);
        w.u32(c.funcIndex >>> 0);
        break;
      case 'native':
        // Natives are rehydrated by name at runtime.
        // Payload: native name string.
        w.u8(C_NATIVE);
        w.str(c.name);
        break;
      case 'proto':
        // Prototypes are runtime objects; they are rehydrated as placeholders.
        // Payload: none
        w.u8(C_PROTO);
        break;
      default:
        panic('Unsupported const type in encoder: ' + c.type);
    }
  }
  return w.finish();
}

function decodeConsts(r) {
  const n = r.u32();
  const consts = [];
  for (let i = 0; i < n; i++) {
    const tag = r.u8();
    switch (tag) {
      case C_NULL:
        consts.push({ type: 'null' });
        break;
      case C_UNDEF:
        consts.push({ type: 'undef' });
        break;
      case C_BOOL:
        consts.push({ type: 'bool', value: r.u8() === 1 });
        break;
      case C_NUM:
        consts.push({ type: 'num', value: r.f64() });
        break;
      case C_STR:
        consts.push({ type: 'str', value: r.str() });
        break;
      case C_FUNC:
        // Stored as function index; VM will rehydrate to a closure at runtime.
        consts.push({ type: 'func', funcIndex: r.u32(), name: null, env: null });
        break;
      case C_NATIVE:
        consts.push({ type: 'native', name: r.str(), arity: null, call: null });
        break;
      case C_PROTO:
        consts.push({ type: 'proto', map: Object.create(null), proto: null });
        break;
      default:
        panic('Unsupported const tag in decoder: ' + String(tag));
    }
  }
  return consts;
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

  w.bytes(encodeChunk(TAG_CONSTS, encodeConsts(consts)));
  w.bytes(encodeChunk(TAG_FUNCTIONS, encodeFunctions(functions)));
  w.bytes(encodeChunk(TAG_CLASSES, encodeClasses(classes)));

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

  while (r.off < r.buf.length) {
    const tag = r.u32();
    const len = r.u32();
    const payload = r.bytes(len);
    const rr = new Reader(payload);
    if (tag === TAG_CONSTS) consts = decodeConsts(rr);
    else if (tag === TAG_FUNCTIONS) functions = decodeFunctions(rr);
    else if (tag === TAG_CLASSES) classes = decodeClasses(rr);
    else {
      // Unknown chunk tag: skip for forward compatibility.
    }
  }

  if (!consts) panic('Malformed bundle: missing CONSTS chunk');
  if (!functions) panic('Malformed bundle: missing FUNCTIONS chunk');
  if (!classes) panic('Malformed bundle: missing CLASSES chunk');

  return { bytecodeVersion: 1, consts, functions, classes };
}
