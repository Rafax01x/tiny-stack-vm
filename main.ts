// Tiny stack VM for make.fun's tiny stack ISA (kit: generator/subject/ISA.md;
// the reference VM there is the rule where the two could be read differently).
// Table-driven dispatch over preallocated stack, call stack, memory, output.
//   mkdir -p out && MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// [byte, immediate bytes, pops, pushes]; anything not listed is unknown opcode.
const SPEC: Array<[number, number, number, number]> = [
  [0, 0, 0, 0], [1, 1, 0, 1], [2, 4, 0, 1], [3, 0, 1, 0], [4, 0, 1, 2],
  [5, 0, 2, 2], [6, 0, 2, 3], [7, 0, 3, 3], [16, 0, 2, 1], [17, 0, 2, 1],
  [18, 0, 2, 1], [19, 0, 2, 1], [20, 0, 2, 1], [21, 0, 2, 1], [22, 0, 2, 1],
  [23, 0, 1, 1], [24, 0, 2, 1], [25, 0, 2, 1], [26, 0, 2, 1], [27, 0, 1, 1],
  [28, 0, 2, 1], [29, 0, 2, 1], [30, 0, 2, 1], [32, 0, 2, 1], [33, 0, 2, 1],
  [34, 0, 2, 1], [48, 2, 0, 0], [49, 2, 1, 0], [50, 2, 1, 0], [51, 2, 0, 0],
  [52, 0, 0, 0], [64, 0, 1, 1], [65, 0, 2, 0], [80, 0, 1, 0], [81, 0, 1, 0],
  [82, 0, 0, 1], [83, 0, 1, 0],
];
const IMM = new Uint8Array(256), POPS = new Uint8Array(256);
const PUSHES = new Uint8Array(256), KNOWN = new Uint8Array(256);
for (const [b, im, po, pu] of SPEC) { IMM[b] = im; POPS[b] = po; PUSHES[b] = pu; KNOWN[b] = 1; }

function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = p.length, s = new Int32Array(256);
  let sp = 0;
  const c = new Int32Array(64);
  let cp = 0;
  const m = new Int32Array(256), o = new Uint8Array(65536);
  let ol = 0, ip = 0, pc = 0, steps = 0;
  const dg = new Uint8Array(12);
  const end = (code: number) => ({ out: o.subarray(0, ol), code });
  for (;;) {
    // Step order is the ISA's: step limit, pc range, opcode, immediate.
    if (steps === 1e6) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = p[pc];
    if (!KNOWN[op]) return end(5);
    const im = IMM[op];
    if (pc + im >= n) return end(9);
    steps++;
    const po = POPS[op]; // stack needs checked before the instruction's own traps
    if (sp < po) return end(2);
    if (sp - po + PUSHES[op] > 256) return end(3);
    const nx = pc + 1 + im;
    pc = nx;
    switch (op) {
      case 0: return end(0); // HALT
      case 1: s[sp++] = (p[nx - 1] << 24) >> 24; break; // PUSH8, sign-extended
      case 2: s[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break; // PUSH32 LE
      case 3: sp--; break; // POP
      case 4: s[sp] = s[sp - 1]; sp++; break; // DUP
      case 5: { const t = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = t; break; } // SWAP
      case 6: s[sp] = s[sp - 2]; sp++; break; // OVER
      case 7: { const a = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = a; break; } // ROT
      case 23: s[sp - 1] = -s[sp - 1] | 0; break; // NEG, wraps
      case 27: s[sp - 1] = ~s[sp - 1]; break; // NOT
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24:
      case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = s[sp - 1], a = s[sp - 2];
        let r: number;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0; // LTU
        sp -= 2; s[sp++] = r;
        break;
      }
      case 48: case 49: case 50: { // JMP / JZ / JNZ, rel16 signed
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = op === 48;
        if (op !== 48) { const v = s[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51: // CALL, abs u16; depth 64 traps 7
        if (cp === 64) return end(7);
        c[cp++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52: // RET; empty call stack traps 8
        if (!cp) return end(8);
        pc = c[--cp];
        break;
      case 64: { // LOAD; addr outside 0..255 traps 6
        const a = s[sp - 1];
        if (a < 0 || a > 255) return end(6);
        s[sp - 1] = m[a];
        break;
      }
      case 65: { // STORE; top is addr, below it the value
        const a = s[sp - 1], v = s[sp - 2];
        if (a < 0 || a > 255) return end(6);
        sp -= 2; m[a] = v;
        break;
      }
      case 80: { // PRINT: decimal ASCII, no newline; limit checked first
        const v = s[sp - 1], neg = v < 0;
        let mag = neg ? -v : v; // -INT_MIN is 2147483648, exact as a double
        let d = 0;
        if (!mag) dg[d++] = 48;
        else while (mag > 0) { dg[d++] = 48 + (mag % 10); mag = Math.floor(mag / 10); }
        const len = d + (neg ? 1 : 0);
        if (ol + len > 65536) return end(11);
        sp--;
        if (neg) o[ol++] = 45;
        for (let i = d - 1; i >= 0; i--) o[ol++] = dg[i];
        break;
      }
      case 81: // PUTC: one byte, v & 255
        if (ol + 1 > 65536) return end(11);
        o[ol++] = s[--sp] & 255;
        break;
      case 82: // IN: next byte, or -1 once exhausted
        s[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 83: // EXIT: code is the low byte
        return end(s[--sp] & 255);
      default: return end(5); // unreachable: KNOWN checked above
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}
