import { canonicalize } from "./artefacts/canonical";
import { concatBytes, sha256Hex, utf8ToBytes, ZERO_HASH } from "./artefacts/crypto";
import type { LedgerEntry, LedgerKind, LedgerVerification } from "./types";

/**
 * Append-only, hash-chained decision ledger.
 * hash_n = SHA-256( prevHash || canonicalJson({seq, at, kind, subject, payload, prevHash}) )
 * Any edit to any historical entry breaks every hash after it.
 */
export class Ledger {
  private entries: LedgerEntry[] = [];

  constructor(private readonly clock: () => string) {}

  get length(): number {
    return this.entries.length;
  }

  get head(): string {
    return this.entries.length ? this.entries[this.entries.length - 1].hash : ZERO_HASH;
  }

  list(): LedgerEntry[] {
    return this.entries.slice();
  }

  append(kind: LedgerKind, subject: string, payload: Record<string, unknown>): LedgerEntry {
    const prevHash = this.head;
    const body = {
      seq: this.entries.length,
      at: this.clock(),
      kind,
      subject,
      payload,
      prevHash,
    };
    const hash = computeHash(body);
    const entry: LedgerEntry = { ...body, hash };
    this.entries.push(entry);
    return entry;
  }

  verify(): LedgerVerification {
    return verifyEntries(this.entries);
  }

  /** Demo/test helper: corrupt one stored entry to show the chain detecting it. */
  tamper(seq: number, mutate: (payload: Record<string, unknown>) => Record<string, unknown>): boolean {
    const entry = this.entries[seq];
    if (!entry) return false;
    entry.payload = mutate({ ...entry.payload });
    return true;
  }

  /** Restore a tampered ledger by recomputing nothing: we keep a pristine copy for the demo. */
  clone(): Ledger {
    const l = new Ledger(this.clock);
    l.entries = this.entries.map((e) => ({ ...e, payload: { ...e.payload } }));
    return l;
  }
}

export function computeHash(body: Omit<LedgerEntry, "hash">): string {
  return sha256Hex(concatBytes(utf8ToBytes(body.prevHash), utf8ToBytes(canonicalize(body))));
}

export function verifyEntries(entries: LedgerEntry[]): LedgerVerification {
  let prev = ZERO_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i) {
      return { ok: false, length: entries.length, head: prev, brokenAt: i, detail: `sequence gap at ${i}` };
    }
    if (e.prevHash !== prev) {
      return { ok: false, length: entries.length, head: prev, brokenAt: i, detail: `prevHash mismatch at seq ${i}` };
    }
    const expected = computeHash({ seq: e.seq, at: e.at, kind: e.kind, subject: e.subject, payload: e.payload, prevHash: e.prevHash });
    if (expected !== e.hash) {
      return { ok: false, length: entries.length, head: prev, brokenAt: i, detail: `content hash mismatch at seq ${i} (${e.kind})` };
    }
    prev = e.hash;
  }
  return { ok: true, length: entries.length, head: prev, brokenAt: null, detail: `chain intact, ${entries.length} entries` };
}
