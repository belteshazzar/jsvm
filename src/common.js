

let lastInstr = null;

function setLastInstr(instr) {
  lastInstr = instr;
}

function panic(msg) {
  const err = new Error(String(msg));
  err.name = 'VMError';
  err.lastInstr = lastInstr;
  throw err;
}

export { setLastInstr, panic }; 