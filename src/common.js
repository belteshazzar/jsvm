

let lastInstr = null;

function setLastInstr(instr) {
  lastInstr = instr;
}

function panic(msg) {
  let message = String(msg);
  const loc = lastInstr?.loc;
  if (loc && typeof loc.line === 'number' && typeof loc.col === 'number') {
    message += ` (at ${loc.line}:${loc.col})`;
  }
  const err = new Error(message);
  err.name = 'VMError';
  err.lastInstr = lastInstr;
  throw err;
}

export { setLastInstr, panic }; 