import { canonicalize } from "./canonical";
import { bytesToHex, hexToBytes, sha256Hex, sign, utf8ToBytes, verify } from "./crypto";
import type { KeyPair } from "./crypto";
import type { Manifest, SignedManifest } from "../types";

export const ARTEFACT_NAME = "mjc/scribe-8b";
/** Synthetic artefact size. Real weights would be ~16 GB; the digest math is identical. */
export const ARTEFACT_BYTES = 256 * 1024;
export const DIODE_CHUNK_BYTES = 8 * 1024;

export function manifestMessage(manifest: Manifest): Uint8Array {
  return utf8ToBytes(canonicalize(manifest));
}

export function buildManifest(version: string, bytes: Uint8Array, builtAt: string): Manifest {
  return {
    name: ARTEFACT_NAME,
    version,
    format: "safetensors",
    digest: sha256Hex(bytes),
    sizeBytes: bytes.length,
    builtAt,
    builder: "mjc-build-01 (low side)",
  };
}

export function signManifest(manifest: Manifest, keys: KeyPair): SignedManifest {
  const signature = sign(manifestMessage(manifest), keys.secretKey);
  return {
    manifest,
    signature: bytesToHex(signature),
    publicKey: bytesToHex(keys.publicKey),
    algorithm: "Ed25519",
    canonicalization: "sorted-keys-json",
  };
}

export interface BundleVerification {
  ok: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

/**
 * What the high side does before anything is imported:
 * 1. the bundle's public key must equal the key pinned inside the enclave,
 * 2. the signature must verify over the canonical manifest,
 * 3. the SHA-256 of the received bytes must equal the digest in the signed manifest.
 */
export function verifyBundle(bytes: Uint8Array, signed: SignedManifest, pinnedPublicKeyHex: string): BundleVerification {
  const checks: BundleVerification["checks"] = [];

  const keyOk = signed.publicKey === pinnedPublicKeyHex;
  checks.push({
    name: "pinned-key",
    ok: keyOk,
    detail: keyOk ? `signer matches pinned key ${short(pinnedPublicKeyHex)}` : `signer ${short(signed.publicKey)} is not the pinned key ${short(pinnedPublicKeyHex)}`,
  });

  let sigOk = false;
  try {
    sigOk = keyOk && verify(hexToBytes(signed.signature), manifestMessage(signed.manifest), hexToBytes(pinnedPublicKeyHex));
  } catch {
    sigOk = false;
  }
  checks.push({
    name: "signature",
    ok: sigOk,
    detail: sigOk ? "Ed25519 signature valid over canonical manifest" : "Ed25519 signature invalid",
  });

  const actual = sha256Hex(bytes);
  const digestOk = actual === signed.manifest.digest;
  checks.push({
    name: "digest",
    ok: digestOk,
    detail: digestOk ? `sha256 ${short(actual)} matches manifest` : `sha256 ${short(actual)} does not match manifest ${short(signed.manifest.digest)}`,
  });

  const sizeOk = bytes.length === signed.manifest.sizeBytes;
  checks.push({ name: "size", ok: sizeOk, detail: sizeOk ? `${bytes.length} bytes` : `expected ${signed.manifest.sizeBytes} bytes, received ${bytes.length}` });

  return { ok: checks.every((c) => c.ok), checks };
}

export function short(hex: string, n = 8): string {
  return hex.length <= n * 2 ? hex : `${hex.slice(0, n)}…${hex.slice(-n)}`;
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}
