/** Small, fast, seedable PRNG (mulberry32). Not cryptographic; used only for synthetic artefact bytes and ids. */
export interface Rng {
  next(): number; // [0,1)
  int(maxExclusive: number): number;
  bytes(length: number): Uint8Array;
  hex(length: number): string;
  fork(label: string): Rng;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (max) => Math.floor(next() * max),
    bytes: (n) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = Math.floor(next() * 256);
      return out;
    },
    hex: (n) => {
      let s = "";
      for (let i = 0; i < n; i++) s += Math.floor(next() * 16).toString(16);
      return s;
    },
    fork: (label) => createRng(hashLabel(label, seed)),
  };
  return rng;
}

function hashLabel(label: string, seed: number): number {
  let h = seed ^ 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
