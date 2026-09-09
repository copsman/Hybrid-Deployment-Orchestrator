/**
 * MERIDIAN // VANTAGE engine.
 * One in-memory simulation of a model deployed across three environments, a policy router,
 * a signed artefact pipeline with a one-way diode, and a hash-chained ledger.
 * Deterministic: same seed + same calls = same ids, digests and hashes.
 */
import { createClock, type Clock } from "./sim/clock";
import { createRng, type Rng } from "./sim/rng";
import { keygen, type KeyPair, hexToBytes, bytesToHex } from "./artefacts/crypto";
import {
  ARTEFACT_BYTES,
  DIODE_CHUNK_BYTES,
  buildManifest,
  compareSemver,
  short,
  signManifest,
  verifyBundle,
  type BundleVerification,
} from "./artefacts/manifest";
import { Ledger } from "./ledger";
import { ENVIRONMENTS, ENV_ORDER, attemptEgress, createRuntime, freeSlots, EgressBlockedError } from "./environments";
import { parseJobInput } from "./schema";
import { POLICY, evaluatePolicy, estimateMinutes, type EnvFacts } from "./policy/evaluate";
import { select } from "./router";
import type {
  ArtefactState,
  ArtefactVersion,
  Decision,
  DiodeTransfer,
  EngineEvent,
  EngineSnapshot,
  EnvId,
  EnvironmentRuntime,
  Job,
  JobInput,
  LedgerVerification,
  ParityReport,
  SignedManifest,
  Verdict,
} from "./types";

export * from "./types";
export { CLASSIFICATION_META } from "./classification";
export { ENVIRONMENTS, ENV_ORDER, EgressBlockedError } from "./environments";
export { POLICY, RULES } from "./policy/evaluate";
export { parseJobInput, JobInputSchema } from "./schema";
export { canonicalize } from "./artefacts/canonical";
export { verifyBundle, short, compareSemver, ARTEFACT_NAME } from "./artefacts/manifest";
export { verifyEntries } from "./ledger";
export type { BundleVerification } from "./artefacts/manifest";

export interface EngineOptions {
  seed?: number;
  startIso?: string;
  baselineVersion?: string;
}

export type SubmitResult =
  | { ok: true; job: Job; decision: Decision }
  | { ok: false; errors: string[] };

export const DEFAULT_SEED = 20310314;
export const BASELINE_VERSION = "1.3.0";

interface ReceivedBundle {
  bytes: Uint8Array;
  signed: SignedManifest;
}

export class Engine {
  readonly seed: number;
  readonly clock: Clock;
  readonly pinnedPublicKey: string;
  private rng!: Rng;
  private buildKeys!: KeyPair;
  private rogueKeys!: KeyPair;
  private jobs = new Map<string, Job>();
  private decisions: Decision[] = [];
  private envs!: Record<EnvId, EnvironmentRuntime>;
  private artefacts = new Map<string, ArtefactVersion>();
  private received = new Map<string, ReceivedBundle>();
  private finishAt = new Map<string, number>();
  private counters = { job: 0, decision: 0, transfer: 0 };
  private listeners = new Set<(e: EngineEvent) => void>();
  private pristineLedger: Ledger | null = null;
  private readonly options: Required<EngineOptions>;
  ledger!: Ledger;

  constructor(options: EngineOptions = {}) {
    this.options = {
      seed: options.seed ?? DEFAULT_SEED,
      startIso: options.startIso ?? "2031-03-14T08:00:00.000Z",
      baselineVersion: options.baselineVersion ?? BASELINE_VERSION,
    };
    this.seed = this.options.seed;
    this.clock = createClock(this.options.startIso);
    // Signing keys are derived from the seed so the demo is reproducible. In production the
    // build key lives in an HSM on the low side and only the public half is provisioned.
    const keyRng = createRng(this.seed).fork("signing-key");
    this.buildKeys = keygen(keyRng.bytes(32));
    this.rogueKeys = keygen(createRng(this.seed).fork("rogue-key").bytes(32));
    this.pinnedPublicKey = bytesToHex(this.buildKeys.publicKey);
    this.boot();
  }

  // ------------------------------------------------------------------ lifecycle

  private boot(): void {
    this.rng = createRng(this.seed);
    this.jobs.clear();
    this.decisions = [];
    this.artefacts.clear();
    this.received.clear();
    this.finishAt.clear();
    this.counters = { job: 0, decision: 0, transfer: 0 };
    this.pristineLedger = null;
    this.envs = { cloud: createRuntime("cloud"), onprem: createRuntime("onprem"), airgapped: createRuntime("airgapped") };
    this.ledger = new Ledger(() => this.clock.iso());
    this.ledger.append("GENESIS", "MERIDIAN // VANTAGE", {
      policyId: POLICY.policyId,
      policyVersion: POLICY.version,
      pinnedPublicKey: this.pinnedPublicKey,
      seed: this.seed,
    });
    // Baseline version is already deployed everywhere when the control room opens.
    const v = this.options.baselineVersion;
    this.build(v);
    this.sign(v);
    this.publish(v);
    this.mirror(v);
    this.stage(v);
    this.diodeTransferAll(v);
    this.quarantineScan(v);
    this.approveImport(v, "OPS-WATCH-1");
    this.approveImport(v, "SEC-OFFICER-2");
    this.verifyImport(v);
    this.loadInEnclave(v);
    this.clock.advance(15 * 60_000);
  }

  reset(): void {
    // A fresh clock too, so a second run reproduces the first exactly.
    (this as { clock: Clock }).clock = createClock(this.options.startIso);
    this.boot();
    this.emit({ type: "reset" });
  }

  subscribe(fn: (e: EngineEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: EngineEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private nextId(kind: keyof typeof this.counters, prefix: string): string {
    this.counters[kind] += 1;
    return `${prefix}-${String(this.counters[kind]).padStart(3, "0")}`;
  }

  // ------------------------------------------------------------------ jobs

  /** Validate untrusted input, evaluate policy, dispatch. Never throws on bad input. */
  submit(raw: unknown): SubmitResult {
    const parsed = parseJobInput(raw);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    const input = parsed.value;
    const jobId = input.id ?? this.nextId("job", "JOB");
    if (this.jobs.has(jobId)) return { ok: false, errors: [`id: job ${jobId} already exists`] };

    const decision = this.evaluate({ ...input, id: jobId }, false);
    const job: Job = {
      ...input,
      id: jobId,
      submittedAt: this.clock.iso(),
      status: "SUBMITTED",
      environment: null,
      decisionId: decision.id,
    };
    this.jobs.set(jobId, job);
    this.applyVerdict(job, decision);
    this.emit({ type: "job.decided", decision, job: { ...job } });
    return { ok: true, job: { ...job }, decision };
  }

  /** Evaluate without dispatching when dryRun is true (used by what-if). */
  evaluate(input: JobInput, dryRun: boolean): Decision {
    const facts = this.facts(input.modelVersion);
    const outcome = evaluatePolicy(input, facts);
    let verdict: Verdict;
    if (outcome.refusal) {
      verdict = { kind: "REFUSE", reason: outcome.refusal.reason, ruleId: outcome.refusal.ruleId };
    } else {
      const queueLengths = { cloud: this.envs.cloud.queue.length, onprem: this.envs.onprem.queue.length, airgapped: this.envs.airgapped.queue.length };
      const selected = select(outcome.candidates, queueLengths);
      verdict = selected ?? { kind: "REFUSE", reason: "No environment satisfied policy.", ruleId: "POL-DEFAULT" };
    }
    const id = dryRun ? `DRY-${this.counters.decision + 1}` : this.nextId("decision", "DEC");
    const justification = this.describe(verdict, input);
    const decision: Decision = {
      id,
      jobId: input.id ?? "(unsubmitted)",
      at: this.clock.iso(),
      input: { ...input },
      trace: outcome.trace,
      candidates: outcome.candidates,
      verdict,
      justification,
      ledgerHash: "",
      dryRun,
    };
    if (!dryRun) {
      const entry = this.ledger.append("DECISION", decision.jobId, {
        decisionId: id,
        classification: input.classification,
        pii: input.pii,
        egress: input.egress,
        releasability: input.releasability,
        modelVersion: input.modelVersion,
        verdict,
        matchedRules: outcome.trace.filter((t) => t.matched).map((t) => t.ruleId),
      });
      decision.ledgerHash = entry.hash;
      this.decisions.push(decision);
      this.emit({ type: "ledger.appended", entry });
    }
    return decision;
  }

  private describe(verdict: Verdict, input: JobInput): string {
    const env = (id: EnvId) => `${ENVIRONMENTS[id].codename} (${ENVIRONMENTS[id].name})`;
    switch (verdict.kind) {
      case "ROUTE":
        return `${input.classification} job routed to ${env(verdict.env)}: ${verdict.tieBreak}.`;
      case "QUEUE":
        return `${input.classification} job queued at ${env(verdict.env)} in position ${verdict.position}: ${verdict.tieBreak}.`;
      case "REFUSE":
        return `Refused by ${verdict.ruleId}: ${verdict.reason}`;
    }
  }

  private facts(version: string): Record<EnvId, EnvFacts> {
    const art = this.artefacts.get(version);
    const out = {} as Record<EnvId, EnvFacts>;
    for (const id of ENV_ORDER) {
      const rt = this.envs[id];
      out[id] = {
        env: id,
        hasVersion: art ? art.loadedIn[id] : false,
        versionInFlight: art ? !art.loadedIn[id] && art.state !== "REJECTED" && art.state !== "LOADED" : false,
        egress: rt.spec.egress,
        freeSlots: freeSlots(rt),
        costPerMinute: rt.spec.costPerMinute,
      };
    }
    return out;
  }

  private applyVerdict(job: Job, decision: Decision): void {
    const v = decision.verdict;
    if (v.kind === "REFUSE") {
      job.status = "REFUSED";
      return;
    }
    job.environment = v.env;
    const rt = this.envs[v.env];
    if (v.kind === "QUEUE") {
      job.status = "QUEUED";
      job.queuePosition = v.position;
      rt.queue.push(job.id);
      this.ledger.append("QUEUE", job.id, { env: v.env, position: v.position });
      return;
    }
    this.start(job, rt);
  }

  private start(job: Job, rt: EnvironmentRuntime): void {
    job.status = "RUNNING";
    job.queuePosition = undefined;
    rt.running.push(job.id);
    const minutes = estimateMinutes(job);
    this.finishAt.set(job.id, this.clock.now().getTime() + minutes * 60_000);
    const entry = this.ledger.append("DISPATCH", job.id, { env: rt.spec.id, modelVersion: job.modelVersion, estimatedMinutes: minutes });
    this.emit({ type: "ledger.appended", entry });
    this.emit({ type: "job.started", job: { ...job } });
  }

  /** Advance simulated time; finish due jobs; promote queued jobs. */
  tick(ms: number): Job[] {
    this.clock.advance(ms);
    const now = this.clock.now().getTime();
    const done: Job[] = [];
    for (const [id, at] of [...this.finishAt.entries()].sort((a, b) => a[1] - b[1])) {
      if (at <= now) done.push(this.finish(id));
    }
    return done;
  }

  /** Force a running job to completion (director convenience). */
  completeJob(jobId: string): Job {
    if (!this.finishAt.has(jobId)) throw new Error(`job ${jobId} is not running`);
    return this.finish(jobId);
  }

  private finish(jobId: string): Job {
    const job = this.jobs.get(jobId)!;
    const rt = this.envs[job.environment!];
    this.finishAt.delete(jobId);
    rt.running = rt.running.filter((id) => id !== jobId);
    rt.completed += 1;
    const minutes = estimateMinutes(job);
    const credits = Math.round(rt.spec.costPerMinute * minutes * 100) / 100;
    rt.spentCredits = Math.round((rt.spentCredits + credits) * 100) / 100;
    job.status = "COMPLETED";
    job.outputPreview = this.preview(job, rt);
    const entry = this.ledger.append("COMPLETE", job.id, { env: rt.spec.id, credits, modelVersion: job.modelVersion });
    this.emit({ type: "ledger.appended", entry });
    this.emit({ type: "job.completed", job: { ...job } });
    // Promote the next queued job, if any.
    const next = rt.queue.shift();
    if (next) {
      const nj = this.jobs.get(next)!;
      this.start(nj, rt);
      for (const [i, qid] of rt.queue.entries()) this.jobs.get(qid)!.queuePosition = i + 1;
    }
    return { ...job };
  }

  private preview(job: Job, rt: EnvironmentRuntime): string {
    const tokens = 180 + this.rng.fork(`tokens:${job.id}`).int(420);
    const lines: Record<string, string> = {
      OPEN: "Draft brief prepared for public release. Tone: factual, no operational detail.",
      RESTRICTED: "Maintenance anomalies summarised for the fleet officer. Personal identifiers retained on-site.",
      SECRET: "Fusion summary compiled inside the enclave. Nothing left the perimeter.",
    };
    return `SCRIBE ${job.modelVersion} @ ${rt.spec.codename} · ${tokens} tokens · ${lines[job.classification] ?? "Completed."}`;
  }

  // ------------------------------------------------------------------ what-if support

  latestLoadedVersion(env: EnvId): string | null {
    let best: string | null = null;
    for (const a of this.artefacts.values()) {
      if (a.loadedIn[env] && (best === null || compareSemver(a.version, best) > 0)) best = a.version;
    }
    return best;
  }

  // ------------------------------------------------------------------ artefact pipeline

  private art(version: string): ArtefactVersion {
    const a = this.artefacts.get(version);
    if (!a) throw new Error(`unknown artefact version ${version}`);
    return a;
  }

  private setState(a: ArtefactVersion, state: ArtefactState, note: string): void {
    a.state = state;
    a.history.push({ at: this.clock.iso(), state, note });
    this.emit({ type: "artefact.state", version: a.version, state, note });
  }

  private expect(a: ArtefactVersion, ...states: ArtefactState[]): void {
    if (!states.includes(a.state)) {
      throw new Error(`artefact ${a.version} is ${a.state}; expected ${states.join(" or ")}`);
    }
  }

  build(version: string): ArtefactVersion {
    if (this.artefacts.has(version)) throw new Error(`artefact ${version} already built`);
    const bytes = this.rng.fork(`artefact:${version}`).bytes(ARTEFACT_BYTES);
    const manifest = buildManifest(version, bytes, this.clock.iso());
    const a: ArtefactVersion = {
      version,
      manifest: { manifest, signature: "", publicKey: "", algorithm: "Ed25519", canonicalization: "sorted-keys-json" },
      bytes,
      state: "BUILT",
      presentIn: { cloud: false, onprem: false, airgapped: false },
      loadedIn: { cloud: false, onprem: false, airgapped: false },
      transfer: null,
      approvals: [],
      rejectionReason: null,
      history: [],
    };
    this.artefacts.set(version, a);
    this.setState(a, "BUILT", `built on low side, sha256 ${short(manifest.digest)}`);
    this.ledger.append("ARTEFACT_BUILT", version, { digest: manifest.digest, sizeBytes: manifest.sizeBytes });
    this.clock.advance(20_000);
    return a;
  }

  sign(version: string): ArtefactVersion {
    const a = this.art(version);
    this.expect(a, "BUILT");
    a.manifest = signManifest(a.manifest.manifest, this.buildKeys);
    this.setState(a, "SIGNED", `manifest signed, Ed25519 key ${short(a.manifest.publicKey)}`);
    this.ledger.append("ARTEFACT_SIGNED", version, { signature: a.manifest.signature, publicKey: a.manifest.publicKey });
    this.clock.advance(5_000);
    return a;
  }

  publish(version: string): ArtefactVersion {
    const a = this.art(version);
    this.expect(a, "SIGNED");
    a.presentIn.cloud = true;
    a.loadedIn.cloud = true;
    this.setState(a, "PUBLISHED", "pushed to GHCR; cloud inference pool pulled and loaded");
    this.ledger.append("PUBLISHED", version, { env: "cloud", registry: "ghcr" });
    this.clock.advance(40_000);
    return a;
  }

  mirror(version: string): ArtefactVersion {
    const a = this.art(version);
    this.expect(a, "PUBLISHED");
    attemptEgress(this.envs.onprem, "ghcr (via inspection proxy)");
    a.presentIn.onprem = true;
    a.loadedIn.onprem = true;
    this.setState(a, "MIRRORED", "Harbor mirror synced through the inspection proxy; vLLM nodes loaded");
    this.ledger.append("MIRRORED", version, { env: "onprem", registry: "harbor" });
    this.clock.advance(60_000);
    return a;
  }

  stage(version: string): ArtefactVersion {
    const a = this.art(version);
    this.expect(a, "MIRRORED");
    const totalChunks = Math.ceil(a.bytes.length / DIODE_CHUNK_BYTES);
    a.transfer = {
      id: this.nextId("transfer", "DIODE"),
      version,
      totalChunks,
      sentChunks: 0,
      returnAttempts: 0,
      startedAt: this.clock.iso(),
      completedAt: null,
    };
    // The high side receives a copy; what it receives is what it verifies.
    this.received.set(version, { bytes: new Uint8Array(a.bytes), signed: { ...a.manifest, manifest: { ...a.manifest.manifest } } });
    this.setState(a, "STAGED", `bundle staged in low-side outbox, ${totalChunks} chunks`);
    this.ledger.append("DIODE_STAGED", version, { transferId: a.transfer.id, chunks: totalChunks });
    return a;
  }

  /** Push N chunks through the one-way link. No acknowledgement ever comes back. */
  diodeStep(version: string, chunks = 1): DiodeTransfer {
    const a = this.art(version);
    this.expect(a, "STAGED", "IN_DIODE");
    const t = a.transfer!;
    if (a.state === "STAGED") this.setState(a, "IN_DIODE", "one-way transfer started");
    t.sentChunks = Math.min(t.totalChunks, t.sentChunks + Math.max(1, chunks));
    this.clock.advance(1_500 * chunks);
    if (t.sentChunks >= t.totalChunks) {
      t.completedAt = this.clock.iso();
      this.setState(a, "QUARANTINE", "all chunks received on high side; held in quarantine");
      this.ledger.append("DIODE_TRANSFER", version, { transferId: t.id, chunks: t.totalChunks, returnAttempts: t.returnAttempts });
    }
    this.emit({ type: "diode.progress", transfer: { ...t } });
    return { ...t };
  }

  diodeTransferAll(version: string): DiodeTransfer {
    let t = this.diodeStep(version, 4);
    while (t.completedAt === null) t = this.diodeStep(version, 4);
    return t;
  }

  /**
   * Simulates the high side trying to talk back (an ACK, a telemetry beacon, a registry pull).
   * A diode is physically one-way, so this always fails and is counted.
   */
  attemptReturnPath(version: string, target = "low-side ack"): EgressBlockedError {
    const a = this.art(version);
    if (a.transfer) a.transfer.returnAttempts += 1;
    try {
      attemptEgress(this.envs.airgapped, target);
    } catch (e) {
      if (e instanceof EgressBlockedError) {
        this.emit({ type: "egress.blocked", env: "airgapped", target });
        return e;
      }
      throw e;
    }
    throw new Error("unreachable: enclave egress must be blocked");
  }

  quarantineScan(version: string): { clean: boolean; detail: string } {
    const a = this.art(version);
    this.expect(a, "QUARANTINE");
    const detail = "ClamAV signature scan clean; file type safetensors confirmed; no executable segments";
    this.setState(a, "QUARANTINE", detail);
    this.ledger.append("QUARANTINE_SCAN", version, { clean: true });
    this.clock.advance(25_000);
    return { clean: true, detail };
  }

  /** Two-person rule: two distinct operators must approve before verification can run. */
  approveImport(version: string, operator: string): ArtefactVersion {
    const a = this.art(version);
    this.expect(a, "QUARANTINE", "VERIFYING");
    if (a.approvals.some((ap) => ap.operator === operator)) throw new Error(`${operator} has already approved ${version}`);
    a.approvals.push({ operator, at: this.clock.iso() });
    this.ledger.append("IMPORT_APPROVAL", version, { operator, count: a.approvals.length });
    if (a.approvals.length >= 2 && a.state === "QUARANTINE") {
      this.setState(a, "VERIFYING", `two-person approval complete (${a.approvals.map((x) => x.operator).join(", ")})`);
    }
    this.clock.advance(8_000);
    return a;
  }

  /** Verify the received bundle against the pinned key. This is the step that must never be skipped. */
  verifyImport(version: string, opts: { allowDowngrade?: boolean } = {}): BundleVerification {
    const a = this.art(version);
    this.expect(a, "VERIFYING");
    const rx = this.received.get(version);
    if (!rx) throw new Error(`nothing received for ${version}`);
    const result = verifyBundle(rx.bytes, rx.signed, this.pinnedPublicKey);

    const current = this.latestLoadedVersion("airgapped");
    if (current && compareSemver(version, current) < 0 && !opts.allowDowngrade) {
      result.ok = false;
      result.checks.push({ name: "downgrade", ok: false, detail: `enclave runs ${current}; importing ${version} would be a downgrade` });
    } else {
      result.checks.push({ name: "downgrade", ok: true, detail: current ? `newer than ${current}` : "first import" });
    }

    if (result.ok) {
      a.presentIn.airgapped = true;
      this.setState(a, "IMPORTED", "signature and digest verified against pinned key; registered in enclave Harbor");
      this.ledger.append("IMPORT_VERIFIED", version, { checks: result.checks.map((c) => c.name), digest: rx.signed.manifest.digest });
    } else {
      const failed = result.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
      a.rejectionReason = failed.join("; ");
      this.setState(a, "REJECTED", `import rejected: ${a.rejectionReason}`);
      this.ledger.append("IMPORT_REJECTED", version, { failed });
    }
    this.clock.advance(12_000);
    return result;
  }

  loadInEnclave(version: string): ArtefactVersion {
    const a = this.art(version);
    this.expect(a, "IMPORTED");
    a.loadedIn.airgapped = true;
    this.setState(a, "LOADED", "vLLM (offline) loaded the weights; enclave now serves this version");
    this.clock.advance(30_000);
    return a;
  }

  /**
   * Demo/test helper: corrupt what the high side received.
   * "byte"   flips one byte of the weights (digest check fails)
   * "signer" re-signs the manifest with a key that is not the pinned one (key + signature checks fail)
   */
  tamperReceived(version: string, mode: "byte" | "signer"): void {
    const rx = this.received.get(version);
    if (!rx) throw new Error(`nothing received for ${version}`);
    if (mode === "byte") {
      const i = 1234 % rx.bytes.length;
      rx.bytes[i] = rx.bytes[i] ^ 0x01;
    } else {
      rx.signed = signManifest(rx.signed.manifest, this.rogueKeys);
    }
  }

  parity(version: string): ParityReport {
    const a = this.artefacts.get(version);
    const digests: Record<EnvId, string | null> = { cloud: null, onprem: null, airgapped: null };
    if (a) {
      for (const env of ENV_ORDER) digests[env] = a.loadedIn[env] ? a.manifest.manifest.digest : null;
    }
    const present = ENV_ORDER.filter((e) => digests[e] !== null);
    const consistent = present.length === ENV_ORDER.length && new Set(present.map((e) => digests[e])).size === 1;
    return { version, digests, consistent, missing: ENV_ORDER.filter((e) => digests[e] === null) };
  }

  // ------------------------------------------------------------------ ledger

  verifyLedger(): LedgerVerification {
    return this.ledger.verify();
  }

  /** Demo: corrupt a historical decision so the chain check fails. restoreLedger() undoes it. */
  tamperLedger(seq?: number): number {
    const entries = this.ledger.list();
    const target = seq ?? entries.findIndex((e) => e.kind === "DECISION");
    if (target < 0 || target >= entries.length) throw new Error("no entry to tamper");
    if (!this.pristineLedger) this.pristineLedger = this.ledger.clone();
    this.ledger.tamper(target, (p) => ({ ...p, verdict: { kind: "ROUTE", env: "cloud", tieBreak: "edited after the fact" } }));
    return target;
  }

  restoreLedger(): boolean {
    if (!this.pristineLedger) return false;
    this.ledger = this.pristineLedger;
    this.pristineLedger = null;
    return true;
  }

  // ------------------------------------------------------------------ read model

  getJob(id: string): Job | undefined {
    const j = this.jobs.get(id);
    return j ? { ...j } : undefined;
  }

  listJobs(): Job[] {
    return [...this.jobs.values()].map((j) => ({ ...j }));
  }

  listDecisions(): Decision[] {
    return this.decisions.slice();
  }

  getDecision(id: string): Decision | undefined {
    return this.decisions.find((d) => d.id === id);
  }

  listEnvironments(): EnvironmentRuntime[] {
    return ENV_ORDER.map((id) => ({ ...this.envs[id], running: [...this.envs[id].running], queue: [...this.envs[id].queue] }));
  }

  getEnvironment(id: EnvId): EnvironmentRuntime {
    return { ...this.envs[id], running: [...this.envs[id].running], queue: [...this.envs[id].queue] };
  }

  listArtefacts(): ArtefactVersion[] {
    return [...this.artefacts.values()].sort((a, b) => compareSemver(a.version, b.version));
  }

  getArtefact(version: string): ArtefactVersion | undefined {
    return this.artefacts.get(version);
  }

  snapshot(): EngineSnapshot {
    return {
      jobs: this.listJobs(),
      decisions: this.listDecisions(),
      environments: this.listEnvironments(),
      artefacts: this.listArtefacts(),
      ledger: this.ledger.list(),
      now: this.clock.iso(),
      seed: this.seed,
    };
  }

  /** Exposed for tests that check the rogue key is rejected. */
  get rogueKeyHex(): string {
    return bytesToHex(this.rogueKeys.publicKey);
  }

  /** Exposed for tests that check hex round-trips. */
  static hexToBytes = hexToBytes;
}
