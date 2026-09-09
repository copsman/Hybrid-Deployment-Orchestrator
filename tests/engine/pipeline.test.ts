import { describe, expect, it } from "vitest";
import { Engine, EgressBlockedError } from "../../src/engine";

function toQuarantine(engine: Engine, v = "2.0.0") {
  engine.build(v);
  engine.sign(v);
  engine.publish(v);
  engine.mirror(v);
  engine.stage(v);
  engine.diodeTransferAll(v);
  engine.quarantineScan(v);
  return engine.getArtefact(v)!;
}

describe("artefact pipeline", () => {
  it("boots with the baseline version loaded and consistent everywhere", () => {
    const engine = new Engine();
    const p = engine.parity("1.3.0");
    expect(p.consistent).toBe(true);
    expect(p.missing).toEqual([]);
    expect(engine.getArtefact("1.3.0")!.state).toBe("LOADED");
  });

  it("walks the full state machine and ends with parity", () => {
    const engine = new Engine();
    const a = toQuarantine(engine);
    expect(a.state).toBe("QUARANTINE");
    expect(a.transfer!.sentChunks).toBe(a.transfer!.totalChunks);
    engine.approveImport("2.0.0", "A");
    expect(engine.getArtefact("2.0.0")!.state).toBe("QUARANTINE");
    engine.approveImport("2.0.0", "B");
    expect(engine.getArtefact("2.0.0")!.state).toBe("VERIFYING");
    const v = engine.verifyImport("2.0.0");
    expect(v.ok).toBe(true);
    engine.loadInEnclave("2.0.0");
    expect(engine.parity("2.0.0").consistent).toBe(true);
    const states = engine.getArtefact("2.0.0")!.history.map((h) => h.state);
    expect(states).toEqual(["BUILT", "SIGNED", "PUBLISHED", "MIRRORED", "STAGED", "IN_DIODE", "QUARANTINE", "QUARANTINE", "VERIFYING", "IMPORTED", "LOADED"]);
  });

  it("enforces step order and the two-person rule", () => {
    const engine = new Engine();
    engine.build("2.0.0");
    expect(() => engine.publish("2.0.0")).toThrow(/expected SIGNED/);
    engine.sign("2.0.0");
    expect(() => engine.verifyImport("2.0.0")).toThrow();
    toQuarantine(engine, "2.1.0");
    engine.approveImport("2.1.0", "SAME");
    expect(() => engine.approveImport("2.1.0", "SAME")).toThrow(/already approved/);
    expect(() => engine.verifyImport("2.1.0")).toThrow(/expected VERIFYING/);
  });

  it("rejects a bundle with one flipped byte", () => {
    const engine = new Engine();
    toQuarantine(engine);
    engine.tamperReceived("2.0.0", "byte");
    engine.approveImport("2.0.0", "A");
    engine.approveImport("2.0.0", "B");
    const v = engine.verifyImport("2.0.0");
    expect(v.ok).toBe(false);
    expect(v.checks.find((c) => c.name === "digest")!.ok).toBe(false);
    expect(engine.getArtefact("2.0.0")!.state).toBe("REJECTED");
    expect(engine.parity("2.0.0").missing).toEqual(["airgapped"]);
    expect(engine.ledger.list().some((e) => e.kind === "IMPORT_REJECTED")).toBe(true);
  });

  it("rejects a bundle signed by a key that is not pinned in the enclave", () => {
    const engine = new Engine();
    toQuarantine(engine);
    engine.tamperReceived("2.0.0", "signer");
    engine.approveImport("2.0.0", "A");
    engine.approveImport("2.0.0", "B");
    const v = engine.verifyImport("2.0.0");
    expect(v.ok).toBe(false);
    expect(v.checks.find((c) => c.name === "pinned-key")!.ok).toBe(false);
    expect(engine.rogueKeyHex).not.toBe(engine.pinnedPublicKey);
  });

  it("refuses a downgrade unless explicitly allowed", () => {
    const engine = new Engine();
    toQuarantine(engine, "0.9.0");
    engine.approveImport("0.9.0", "A");
    engine.approveImport("0.9.0", "B");
    const v = engine.verifyImport("0.9.0");
    expect(v.ok).toBe(false);
    expect(v.checks.find((c) => c.name === "downgrade")!.ok).toBe(false);
  });

  it("the enclave has no return path: every outbound attempt is blocked and counted", () => {
    const engine = new Engine();
    engine.build("2.0.0");
    engine.sign("2.0.0");
    engine.publish("2.0.0");
    engine.mirror("2.0.0");
    engine.stage("2.0.0");
    engine.diodeStep("2.0.0", 3);
    const err = engine.attemptReturnPath("2.0.0", "ack");
    expect(err).toBeInstanceOf(EgressBlockedError);
    expect(engine.getEnvironment("airgapped").blockedEgress).toBeGreaterThanOrEqual(1);
    expect(engine.getArtefact("2.0.0")!.transfer!.returnAttempts).toBe(1);
  });
});
