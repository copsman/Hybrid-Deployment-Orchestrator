import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { keygen, sign, verify, sha256Hex, utf8ToBytes, bytesToHex } from "../../src/engine/artefacts/crypto";
import { buildManifest, signManifest, verifyBundle } from "../../src/engine/artefacts/manifest";

describe("crypto primitives", () => {
  it("sha256 matches a known vector", () => {
    expect(sha256Hex(utf8ToBytes("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("ed25519 keygen is deterministic for a seed and produces 32-byte keys", () => {
    const seed = new Uint8Array(32).fill(7);
    const a = keygen(seed);
    const b = keygen(seed);
    expect(bytesToHex(a.publicKey)).toBe(bytesToHex(b.publicKey));
    expect(a.publicKey.length).toBe(32);
    expect(a.secretKey.length).toBe(32);
    expect(() => keygen(new Uint8Array(16))).toThrow();
  });

  it("signatures verify with the right key and fail with the wrong key or altered message (property)", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), fc.uint8Array({ minLength: 32, maxLength: 32 }), fc.uint8Array({ minLength: 1, maxLength: 200 }), (s1, s2, msg) => {
        fc.pre(bytesToHex(s1) !== bytesToHex(s2));
        const k1 = keygen(s1);
        const k2 = keygen(s2);
        const sig = sign(msg, k1.secretKey);
        expect(verify(sig, msg, k1.publicKey)).toBe(true);
        expect(verify(sig, msg, k2.publicKey)).toBe(false);
        const altered = new Uint8Array(msg);
        altered[0] ^= 0xff;
        expect(verify(sig, altered, k1.publicKey)).toBe(false);
      }),
      { numRuns: 40 },
    );
  });

  it("verify never throws on garbage", () => {
    const k = keygen(new Uint8Array(32).fill(1));
    expect(verify(new Uint8Array(3), new Uint8Array(1), k.publicKey)).toBe(false);
    expect(verify(new Uint8Array(64), new Uint8Array(1), new Uint8Array(5))).toBe(false);
  });
});

describe("bundle verification", () => {
  const keys = keygen(new Uint8Array(32).fill(42));
  const rogue = keygen(new Uint8Array(32).fill(43));
  const bytes = new Uint8Array(4096).map((_, i) => (i * 31) % 256);
  const manifest = buildManifest("9.9.9", bytes, "2031-01-01T00:00:00.000Z");
  const signed = signManifest(manifest, keys);
  const pinned = bytesToHex(keys.publicKey);

  it("accepts an untouched bundle", () => {
    const r = verifyBundle(bytes, signed, pinned);
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => c.name)).toEqual(["pinned-key", "signature", "digest", "size"]);
  });

  it("rejects a single flipped byte (digest check)", () => {
    const tampered = new Uint8Array(bytes);
    tampered[100] ^= 0x01;
    const r = verifyBundle(tampered, signed, pinned);
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "digest")!.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "signature")!.ok).toBe(true);
  });

  it("rejects a manifest signed by a key that is not pinned", () => {
    const r = verifyBundle(bytes, signManifest(manifest, rogue), pinned);
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "pinned-key")!.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "signature")!.ok).toBe(false);
  });

  it("rejects a manifest whose version field was edited after signing", () => {
    const edited = { ...signed, manifest: { ...signed.manifest, version: "10.0.0" } };
    const r = verifyBundle(bytes, edited, pinned);
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.name === "signature")!.ok).toBe(false);
  });
});
