import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { canonicalize } from "../../src/engine/artefacts/canonical";

const jsonValue = fc.jsonValue({ maxDepth: 4 });

describe("canonicalize", () => {
  it("sorts keys and strips whitespace", () => {
    expect(canonicalize({ b: 1, a: [true, null, "x"], c: { z: 1, y: 2 } })).toBe('{"a":[true,null,"x"],"b":1,"c":{"y":2,"z":1}}');
  });

  it("is independent of key insertion order", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it("rejects undefined, functions and non-finite numbers at the top level", () => {
    expect(() => canonicalize(undefined)).toThrow();
    expect(() => canonicalize(() => 1)).toThrow();
    expect(() => canonicalize(Number.NaN)).toThrow();
    expect(() => canonicalize({ a: Number.POSITIVE_INFINITY })).toThrow();
  });

  it("drops undefined object members (like JSON.stringify)", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("round-trips through JSON.parse for any JSON value (property)", () => {
    fc.assert(
      fc.property(jsonValue, (v) => {
        const once = canonicalize(v);
        const twice = canonicalize(JSON.parse(once));
        expect(twice).toBe(once);
      }),
      { numRuns: 300 },
    );
  });

  it("is order-independent for any record (property)", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), jsonValue, { noNullPrototype: true }), (rec) => {
        const keys = Object.keys(rec);
        const shuffled: Record<string, unknown> = {};
        for (const k of keys.slice().reverse()) shuffled[k] = rec[k];
        expect(canonicalize(shuffled)).toBe(canonicalize(rec));
      }),
      { numRuns: 200 },
    );
  });
});
