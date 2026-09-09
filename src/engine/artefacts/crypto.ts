/**
 * The single crypto module. Everything that hashes or signs goes through here so the
 * primitives are used the same way in the browser, in vitest and in the tsx CLI.
 *
 * Primitives: SHA-256 for digests and the ledger chain, Ed25519 (RFC 8032, strict
 * verification) for artefact manifests. Nothing is encrypted anywhere in the system:
 * the requirement is integrity and authenticity, not confidentiality.
 */
import * as ed from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils.js";

// Enables the synchronous ed25519 API (sign/verify/keygen) in every runtime.
ed.hashes.sha512 = sha512;

export interface KeyPair {
  secretKey: Uint8Array; // 32 bytes, never leaves the build side
  publicKey: Uint8Array; // 32 bytes, pinned inside each environment
}

export function keygen(seed?: Uint8Array): KeyPair {
  if (seed !== undefined && seed.length !== 32) {
    throw new Error("keygen: seed must be exactly 32 bytes");
  }
  const kp = ed.keygen(seed);
  return { secretKey: kp.secretKey, publicKey: kp.publicKey };
}

export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ed.sign(message, secretKey);
}

export function verify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    // zip215:false = strict RFC 8032 verification (rejects non-canonical encodings).
    return ed.verify(signature, message, publicKey, { zip215: false });
  } catch {
    return false;
  }
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function sha256HexOfString(text: string): string {
  return sha256Hex(utf8ToBytes(text));
}

export const ZERO_HASH = "0".repeat(64);

export { bytesToHex, hexToBytes, utf8ToBytes, concatBytes };
