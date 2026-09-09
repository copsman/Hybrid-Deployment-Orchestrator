import type { Engine } from "./index";
import type { ArtefactVersion, Decision, DiodeTransfer, EnvId, Job, JobInput, LedgerVerification, ParityReport } from "./types";
import type { BundleVerification } from "./artefacts/manifest";

export type Focus = "overview" | "hub" | "diode" | EnvId;

export interface StepResult {
  ok: boolean;
  summary: string;
  decision?: Decision;
  job?: Job;
  artefact?: ArtefactVersion;
  transfer?: DiodeTransfer;
  parity?: ParityReport;
  verification?: BundleVerification;
  ledger?: LedgerVerification;
  bounced?: boolean;
}

export interface ScenarioStep {
  id: string;
  phase: "BOOT" | "JOB" | "PIPELINE" | "DIODE" | "IMPORT" | "LEDGER" | "WRAP";
  title: string;
  caption: string;
  focus: Focus;
  /** milliseconds the director holds on this step at 1x speed */
  holdMs: number;
  run: (engine: Engine) => StepResult | Generator<StepResult, StepResult, void>;
}

export const NEW_VERSION = "1.4.0";

export const SCENARIO_JOBS: Record<"A" | "B" | "C" | "D" | "E", JobInput> = {
  A: {
    title: "Public affairs brief: Exercise NORTHERN LANTERN",
    summary: "Draft a releasable summary of the joint exercise for the press desk.",
    classification: "OPEN",
    pii: false,
    egress: false,
    releasability: "MJC",
    modelVersion: "1.3.0",
    latency: "interactive",
  },
  B: {
    title: "Maintenance log summarisation, 3rd Logistics Group",
    summary: "Summarise 14 days of vehicle fault reports; records include crew names and service numbers.",
    classification: "RESTRICTED",
    pii: true,
    egress: false,
    releasability: "MJC",
    modelVersion: "1.3.0",
    latency: "batch",
  },
  C: {
    title: "Intelligence fusion: sector KESTREL RIDGE",
    summary: "Fuse the overnight reporting into a single assessment for the morning brief.",
    classification: "SECRET",
    pii: false,
    egress: false,
    releasability: "MJC-EYES-ONLY",
    modelVersion: NEW_VERSION,
    latency: "interactive",
  },
  D: {
    title: "Compartmented tasking review",
    summary: "Material marked ONYX from the special access channel.",
    classification: "ONYX",
    pii: false,
    egress: false,
    releasability: "MJC-EYES-ONLY",
    modelVersion: "1.3.0",
    latency: "interactive",
  },
  E: {
    title: "Live open-source cross-check of overnight reporting",
    summary: "Compare the assessment against live web sources and news wires.",
    classification: "SECRET",
    pii: false,
    egress: true,
    releasability: "MJC",
    modelVersion: "1.3.0",
    latency: "interactive",
  },
};

function submit(engine: Engine, input: JobInput, id: string): StepResult {
  const r = engine.submit({ ...input, id });
  if (!r.ok) return { ok: false, summary: `validation failed: ${r.errors.join("; ")}` };
  const v = r.decision.verdict;
  const summary =
    v.kind === "REFUSE"
      ? `${id} REFUSED by ${v.ruleId}`
      : v.kind === "QUEUE"
        ? `${id} QUEUED at ${v.env} (position ${v.position})`
        : `${id} → ${v.env.toUpperCase()}`;
  return { ok: true, summary, decision: r.decision, job: r.job };
}

export const SCENARIO: ScenarioStep[] = [
  {
    id: "boot",
    phase: "BOOT",
    title: "Control room online",
    caption: "Three perimeters. One model. SCRIBE 1.3.0 is loaded in Cloud Region North, Fort Meridian and Enclave OBSIDIAN.",
    focus: "overview",
    holdMs: 4000,
    run: (e) => {
      const parity = e.parity("1.3.0");
      return { ok: parity.consistent, summary: `parity 1.3.0: ${parity.consistent ? "consistent" : "MISMATCH"}`, parity };
    },
  },
  {
    id: "job-a",
    phase: "JOB",
    title: "Job A · OPEN",
    caption: "An OPEN public-affairs brief. Policy permits cloud or on-prem; the cheapest permitted environment wins.",
    focus: "cloud",
    holdMs: 5000,
    run: (e) => submit(e, SCENARIO_JOBS.A, "JOB-A"),
  },
  {
    id: "job-b",
    phase: "JOB",
    title: "Job B · RESTRICTED + PII",
    caption: "RESTRICTED maintenance logs with crew names. Sovereign perimeter only, and personal data never touches shared tenancy.",
    focus: "onprem",
    holdMs: 5000,
    run: (e) => submit(e, SCENARIO_JOBS.B, "JOB-B"),
  },
  {
    id: "job-c-first",
    phase: "JOB",
    title: "Job C · SECRET (first attempt)",
    caption: "SECRET intelligence fusion asks for SCRIBE 1.4.0. The enclave still runs 1.3.0. The router refuses rather than downgrade silently.",
    focus: "airgapped",
    holdMs: 6000,
    run: (e) => submit(e, SCENARIO_JOBS.C, "JOB-C"),
  },
  {
    id: "build",
    phase: "PIPELINE",
    title: "Build and sign 1.4.0",
    caption: "The low side builds SCRIBE 1.4.0, hashes the weights with SHA-256 and signs the manifest with the MJC build key.",
    focus: "hub",
    holdMs: 4500,
    run: (e) => {
      e.build(NEW_VERSION);
      const a = e.sign(NEW_VERSION);
      return { ok: true, summary: `1.4.0 built and signed (${a.manifest.manifest.digest.slice(0, 12)}…)`, artefact: a };
    },
  },
  {
    id: "publish",
    phase: "PIPELINE",
    title: "Publish to cloud",
    caption: "Cloud pulls the signed bundle from the registry and loads it. Elastic, immediate.",
    focus: "cloud",
    holdMs: 3500,
    run: (e) => ({ ok: true, summary: "1.4.0 live in cloud", artefact: e.publish(NEW_VERSION) }),
  },
  {
    id: "mirror",
    phase: "PIPELINE",
    title: "Mirror to on-prem",
    caption: "Fort Meridian syncs through the inspection proxy into its Harbor mirror. Same digest, same signature.",
    focus: "onprem",
    holdMs: 3500,
    run: (e) => ({ ok: true, summary: "1.4.0 mirrored on-prem", artefact: e.mirror(NEW_VERSION) }),
  },
  {
    id: "stage",
    phase: "DIODE",
    title: "Stage for the diode",
    caption: "The enclave cannot pull anything. The bundle is staged in the low-side outbox for a one-way transfer.",
    focus: "diode",
    holdMs: 3000,
    run: (e) => {
      const a = e.stage(NEW_VERSION);
      return { ok: true, summary: `staged ${a.transfer!.totalChunks} chunks`, artefact: a, transfer: a.transfer! };
    },
  },
  {
    id: "diode",
    phase: "DIODE",
    title: "One-way transfer",
    caption: "Chunks cross the data diode. Nothing can come back: the high side's acknowledgement attempt bounces off the gate.",
    focus: "diode",
    holdMs: 9000,
    run: function* (e) {
      let t = e.diodeStep(NEW_VERSION, 2);
      let bounced = false;
      while (t.completedAt === null) {
        yield { ok: true, summary: `chunk ${t.sentChunks}/${t.totalChunks}`, transfer: t };
        if (!bounced && t.sentChunks >= Math.floor(t.totalChunks / 2)) {
          e.attemptReturnPath(NEW_VERSION, "high-side ACK");
          bounced = true;
          yield { ok: true, summary: "return path attempt blocked", transfer: { ...t, returnAttempts: t.returnAttempts + 1 }, bounced: true };
        }
        t = e.diodeStep(NEW_VERSION, 2);
      }
      return { ok: true, summary: `transfer complete, ${t.totalChunks} chunks, ${t.returnAttempts} return attempt blocked`, transfer: t };
    },
  },
  {
    id: "scan",
    phase: "IMPORT",
    title: "Quarantine scan",
    caption: "The bundle sits in quarantine on the high side. Antivirus and file-type checks run before anyone can approve it.",
    focus: "airgapped",
    holdMs: 3500,
    run: (e) => {
      const r = e.quarantineScan(NEW_VERSION);
      return { ok: r.clean, summary: r.detail, artefact: e.getArtefact(NEW_VERSION) };
    },
  },
  {
    id: "approve",
    phase: "IMPORT",
    title: "Two-person approval",
    caption: "Two operators with separate roles approve the import. One person cannot bring an artefact into the enclave alone.",
    focus: "airgapped",
    holdMs: 4500,
    run: (e) => {
      e.approveImport(NEW_VERSION, "OPS-WATCH-1");
      const a = e.approveImport(NEW_VERSION, "SEC-OFFICER-2");
      return { ok: a.state === "VERIFYING", summary: `approved by ${a.approvals.map((x) => x.operator).join(" and ")}`, artefact: a };
    },
  },
  {
    id: "verify",
    phase: "IMPORT",
    title: "Verify and load",
    caption: "The enclave checks the signer against its pinned key, verifies the Ed25519 signature and recomputes the SHA-256. Only then does vLLM load the weights.",
    focus: "airgapped",
    holdMs: 5500,
    run: (e) => {
      const v = e.verifyImport(NEW_VERSION);
      if (!v.ok) return { ok: false, summary: `import rejected: ${v.checks.filter((c) => !c.ok).map((c) => c.detail).join("; ")}`, verification: v };
      const a = e.loadInEnclave(NEW_VERSION);
      return { ok: true, summary: "1.4.0 verified, imported and loaded in the enclave", verification: v, artefact: a };
    },
  },
  {
    id: "parity",
    phase: "PIPELINE",
    title: "Parity check",
    caption: "Same artefact, same digest, in all three environments. Different stacks underneath, identical model on top.",
    focus: "overview",
    holdMs: 4000,
    run: (e) => {
      const parity = e.parity(NEW_VERSION);
      return { ok: parity.consistent, summary: `parity 1.4.0: ${parity.consistent ? "consistent across cloud, on-prem, air-gapped" : "MISMATCH"}`, parity };
    },
  },
  {
    id: "job-c-second",
    phase: "JOB",
    title: "Job C · SECRET (resubmitted)",
    caption: "The same SECRET job again. 1.4.0 is now loaded inside the enclave, so policy routes it there and nowhere else.",
    focus: "airgapped",
    holdMs: 6000,
    run: (e) => submit(e, SCENARIO_JOBS.C, "JOB-C2"),
  },
  {
    id: "job-d",
    phase: "JOB",
    title: "Job D · ONYX",
    caption: "ONYX compartmented material. No environment in this deployment is accredited for it. The router refuses and says why.",
    focus: "hub",
    holdMs: 5000,
    run: (e) => submit(e, SCENARIO_JOBS.D, "JOB-D"),
  },
  {
    id: "job-e",
    phase: "JOB",
    title: "Job E · SECRET + live retrieval",
    caption: "SECRET, but it wants live web sources. SECRET means the enclave, and the enclave has no network. Two constraints that cannot both hold.",
    focus: "hub",
    holdMs: 5000,
    run: (e) => submit(e, SCENARIO_JOBS.E, "JOB-E"),
  },
  {
    id: "complete",
    phase: "WRAP",
    title: "Jobs complete",
    caption: "Running jobs finish. Cloud metered the OPEN job by the minute; Fort Meridian and the enclave charged their fixed-capacity rate.",
    focus: "overview",
    holdMs: 3500,
    run: (e) => {
      const done = e.tick(10 * 60_000);
      return { ok: true, summary: `${done.length} job(s) completed` };
    },
  },
  {
    id: "ledger",
    phase: "LEDGER",
    title: "Ledger verification",
    caption: "Every decision, dispatch and import is a link in a SHA-256 hash chain. Recomputing it proves nothing was edited after the fact.",
    focus: "overview",
    holdMs: 4500,
    run: (e) => {
      const ledger = e.verifyLedger();
      return { ok: ledger.ok, summary: ledger.detail, ledger };
    },
  },
];

/** Runs a step to completion, returning every intermediate result (for the CLI and tests). */
export function drain(engine: Engine, step: ScenarioStep): StepResult[] {
  const out = step.run(engine);
  if (isGenerator(out)) {
    const results: StepResult[] = [];
    let r = out.next();
    while (!r.done) {
      results.push(r.value);
      r = out.next();
    }
    results.push(r.value);
    return results;
  }
  return [out];
}

export function isGenerator(x: unknown): x is Generator<StepResult, StepResult, void> {
  return typeof x === "object" && x !== null && typeof (x as Generator).next === "function";
}

export function runScenario(engine: Engine): { step: ScenarioStep; results: StepResult[] }[] {
  return SCENARIO.map((step) => ({ step, results: drain(engine, step) }));
}
