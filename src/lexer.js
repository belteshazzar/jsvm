
import { panic } from './common.js';

const isAlpha = c => /[A-Za-z_]/.test(c);
const isDigit = c => /[0-9]/.test(c);
const isAlnum = c => /[A-Za-z0-9_]/.test(c);

export default function tokenize(input) {
  const tokens = [];
  let i = 0, line = 1, col = 1;

  function peek() { return input[i] ?? '\0'; }
  function next() {
    const ch = input[i++] ?? '\0';
    if (ch === '\n') { line++; col = 1; } else col++;
    return ch;
  }
  function add(type, value=null) {
    tokens.push({ type, value, line, col });
  }
  function skipSpaceAndComments() {
    for (;;) {
      while (/\s/.test(peek())) next();
      if (peek() === '/' && input[i+1] === '/') {
        while (peek() !== '\n' && peek() !== '\0') next();
        continue;
      }
      if (peek() === '/' && input[i+1] === '*') {
        next(); next();
        while (!(peek() === '*' && input[i+1] === '/')) {
          if (peek() === '\0') panic("Unterminated block comment", {line, col});
          next();
        }
        next(); next();
        continue;
      }
      break;
    }
  }

  const keywords = new Set([
    'let','const','if','else','while','function','return','true','false','null',
    'class','new','this','extends','super'
  ]);

  while (true) {
    skipSpaceAndComments();
    const startLine = line, startCol = col;
    const c = peek();
    if (c === '\0') { add('EOF'); break; }

    if (isAlpha(c)) {
      let s = '';
      while (isAlnum(peek())) s += next();
      if (keywords.has(s)) add(s.toUpperCase(), s);
      else add('IDENT', s);
      continue;
    }

    if (isDigit(c)) {
      let s = '';
      while (isDigit(peek())) s += next();
      if (peek() === '.' && isDigit(input[i+1])) {
        s += next();
        while (isDigit(peek())) s += next();
      }
      add('NUMBER', Number(s));
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = next();
      let s = '';
      while (peek() !== quote) {
        if (peek() === '\0') panic("Unterminated string", {line, col});
        if (peek() === '\\') {
          next();
          const esc = next();
          const map = { 'n':'\n', 't':'\t', 'r':'\r', '"':'"', "'":"'", '\\':'\\' };
          s += map[esc] ?? esc;
        } else {
          s += next();
        }
      }
      next();
      add('STRING', s);
      continue;
    }

    const two = c + input[i+1];
    const three = c + input[i+1] + input[i+2];
    const threeOps = ['===','!=='];
    if (threeOps.includes(three)) { next(); next(); next(); add(three); continue; }

    const twoOps = ['==','!=','<=','>=','&&','||'];
    if (twoOps.includes(two)) { next(); next(); add(two); continue; }

    const single = {
      '+':'PLUS', '-':'MINUS', '*':'STAR', '/':'SLASH', '%':'PERCENT',
      '(':'LPAREN', ')':'RPAREN', '{':'LBRACE', '}':'RBRACE',
      '[':'LBRACK', ']':'RBRACK',
      ';':'SEMI', ',':'COMMA', ':' : 'COLON', '.' : 'DOT',
      '?':'QMARK',
      '=':'EQUAL', '<':'LT', '>':'GT', '!':'BANG'
    };
    if (single[c]) { next(); add(single[c]); continue; }

    panic(`Unexpected character '${c}'`, {line:startLine, col:startCol});
  }

  return tokens;
}

