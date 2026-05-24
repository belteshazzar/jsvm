# Bytecode File Format

This document describes the on-disk bytecode file format produced by jsvm.

The file format is binary and chunked. The current container is JSVB v1.

## Container overview

All integer fields are little-endian.

### File header

1. 4 bytes: ASCII magic JSVB
2. u16: container version (currently 1)
3. u16: flags (currently 0)

### Chunk stream

After the header, the file is a sequence of chunks:

1. u32: chunk tag
2. u32: payload byte length
3. payload bytes

Unknown chunk tags are skipped by the decoder.

## Supported chunks (v1)

1. tag 1: CONSTS
2. tag 2: FUNCTIONS
3. tag 3: CLASSES
4. tag 4: IMPORTS
5. tag 5: EXPORTS
6. tag 6: DEFAULT_EXPORT
7. tag 7: REEXPORTS

All three chunks are required in v1.

## CONSTS chunk payload

The CONSTS payload encodes:

1. u32: constant count
2. repeated constant entries

Each constant entry starts with a u8 constant tag:

1. 0: null (no extra bytes)
2. 1: undef (no extra bytes)
3. 2: bool (u8 0 or 1)
4. 3: num (f64)
5. 4: str (u32 length + UTF-8 bytes)
6. 5: func (u32 funcIndex)
7. 6: native (string name)
8. 7: proto (no extra bytes)
9. 8: arr (u32 item count, then nested constant entries)
10. 9: obj (u32 key/value count, then repeated string key + nested constant entry)

## FUNCTIONS chunk payload

The FUNCTIONS payload encodes:

1. u32: function count
2. repeated function entries

Each function entry:

1. string: name
2. u32: arity
3. u32: parameter count
4. repeated parameter names as strings
5. u32: instruction count
6. repeated encoded instructions
7. u8: async flag (0 or 1)
8. u32: awaitSites count
9. repeated u32 await site indices

### Encoded instruction

Each instruction is stored as:

1. string: op
2. tagged operand a
3. tagged operand b
4. u32: loc.line (0 means missing)
5. u32: loc.col (0 means missing)

Tagged operand format (for both a and b):

1. u8 tag 0: null
2. u8 tag 1: i32 value
3. u8 tag 2: string value

## CLASSES chunk payload

The CLASSES payload encodes:

1. u32: class count
2. repeated class entries

Each class entry:

1. string: name
2. u8: hasSuper (0 or 1)
3. if hasSuper is 1: string superName
4. i32: ctorIndex (-1 means null)
5. u32: method count
6. repeated methods:
1. string: method name
2. u32: funcIndex

## IMPORTS chunk payload

The IMPORTS payload encodes:

1. u32: import declaration count
2. repeated import declarations

Each import declaration:

1. string: source
2. u32: specifier count
3. repeated specifiers:
1. string: imported
2. string: local

## EXPORTS chunk payload

The EXPORTS payload encodes:

1. u32: export specifier count
2. repeated export specifiers:
1. string: exported
2. string: local

## DEFAULT_EXPORT chunk payload

The DEFAULT_EXPORT payload encodes:

1. u8: hasDefault (0 or 1)
2. if hasDefault is 1: string containing serialized AST JSON for the default export expression

## REEXPORTS chunk payload

The REEXPORTS payload encodes:

1. u32: re-export declaration count
2. repeated re-export declarations

Each re-export declaration:

1. string: source
2. u32: specifier count
3. repeated specifiers:
1. string: local
2. string: exported

## Decode result shape

Decoding a file currently produces this in-memory bundle shape:

1. bytecodeVersion
2. consts
3. functions
4. classes
5. imports
6. exports
7. defaultExport
8. reExports

## Versioning and compatibility

1. Container version is independent from bytecodeVersion and is stored in the binary header.
2. Current container version is 1.
3. Decoders reject unsupported container versions.
4. Unknown chunk tags are ignored for forward compatibility.
