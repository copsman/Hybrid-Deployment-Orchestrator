import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { Ledger, verifyEntries } from "../../src/engine/ledger";
import type { LedgerKind } from "../../src/engine/types";

const kinds: LedgerKind[] = ["DECISION", "DISPATCH", "COMPLETE", "PUBLISHED", "DIODE_TRANSFER", "IMPORT_VERIFIED"];

describe("hash-chained ledger", () => {
  it("starts from the zero hash and links entries", () => {
    const l = new Ledger(() => "2031-01-01T00:00:00.000Z");
    const a = l.append("GENESIS", "x", {});
    const b = l.append("DECISION", "JOB-1", { verdict: "ROUTE" });
    expect(a.prevHash).toBe("0".repeat(64));
    expect(b.prevHash).toBe(a.hash);
    expect(l.verify().ok).toBe(true);
    expect(l.head).toBe(b.hash);
  });

  it("is deterministic for identical inputs", () => {
    const mk = () => {
      const l = new Ledger(() => "2031-01-01T00:00:00.000Z");
      l.append("GENESIS", "x", { seed: 1 });
      l.append("DECISION", "JOB-1", { a: 1, b: [1, 2] });
      return l.head;
    };
    expect(mk()).toBe(mk());
  });

  it("detects tampering of any historical entry (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...kinds), { minLength: 1, maxLength: 25 }), fc.nat(), (ks, pick) => {
        const l = new Ledger(() => "2031-01-01T00:00:00.000Z");
        ks.forEach((k, i) => l.append(k, `S-${i}`, { i }));
        expect(l.verify().ok).toBe(true);
        const target = pick % ks.length;
        l.tamper(target, (p) => ({ ...p, i: (p.i as number) + 1 }));
        const v = l.verify();
        expect(v.ok).toBe(false);
        expect(v.brokenAt).toBe(target);
      }),
      { numRuns: 100 },
    );
  });

  it("detects a re-ordered or truncated chain", () => {
    const l = new Ledger(() => "2031-01-01T00:00:00.000Z");
    l.append("GENESIS", "x", {});
    l.append("DECISION", "a", {});
    l.append("DISPATCH", "a", {});
    const entries = l.list();
    const swapped = [entries[0], entries[2], entries[1]];
    expect(verifyEntries(swapped).ok).toBe(false);
    const forged = entries.map((e, i) => (i === 1 ? { ...e, hash: "ab".repeat(32) } : e));
    expect(verifyEntries(forged).ok).toBe(false);
  });
});
