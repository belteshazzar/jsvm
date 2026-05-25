export function panic(msg) {
  const err = new Error(String(msg));
  err.name = 'BytecodeError';
  throw err;
}
