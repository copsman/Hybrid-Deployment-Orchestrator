import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { Engine, CLASSIFICATIONS, RELEASABILITIES, LATENCIES, RULES, parseJobInput } from "../../src/engine";
import type { JobInput } from "../../src/engine";

const jobArb: fc.Arbitrary<JobInput> = fc.record(
  {
    title: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
    summary: fc.string({ maxLength: 80 }),
    classification: fc.constantFrom(...CLASSIFICATIONS),
    pii: fc.boolean(),
    egress: fc.boolean(),
    releasability: fc.constantFrom(...RELEASABILITIES),
    modelVersion: fc.constantFrom("1.3.0", "1.4.0", "0.9.0"),
    latency: fc.constantFrom(...LATENCIES),
  },
  { noNullPrototype: true },
);

describe("policy file", () => {
  it("loads, is ordered, and has unique ids", () => {
    expect(RULES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    expect(RULES[0].id).toBe("POL-01");
  });
});

describe("routing invariants (property-based)", () => {
  it("SECRET never lands on cloud or on-prem; ONYX is always refused; egress never lands air-gapped", () => {
    fc.assert(
      fc.property(jobArb, (job) => {
        const engine = new Engine();
        const d = engine.evaluate(job, true);
        const v = d.verdict;
        if (job.classification === "ONYX") expect(v.kind).toBe("REFUSE");
        if (job.classification === "SECRET" && v.kind !== "REFUSE") expect(v.env).toBe("airgapped");
        if (job.classification === "RESTRICTED" && v.kind !== "REFUSE") expect(v.env).toBe("onprem");
        if (job.egress && v.kind !== "REFUSE") expect(v.env).not.toBe("airgapped");
        if (job.pii && v.kind !== "REFUSE") expect(v.env).not.toBe("cloud");
        if (job.releasability === "MJC-EYES-ONLY" && v.kind !== "REFUSE") expect(v.env).not.toBe("cloud");
      }),
      { numRuns: 400 },
    );
  });

  it("every decision carries a rule trace, candidates for all three environments and a justification", () => {
    fc.assert(
      fc.property(jobArb, (job) => {
        const d = new Engine().evaluate(job, true);
        expect(d.trace.length).toBeGreaterThanOrEqual(RULES.length + 2);
        expect(d.candidates.map((c) => c.env).sort()).toEqual(["airgapped", "cloud", "onprem"]);
        expect(d.justification.length).toBeGreaterThan(10);
        const v = d.verdict;
        if (v.kind === "REFUSE") {
          expect(v.ruleId).toMatch(/^(POL-\d{2}|POL-DEFAULT|CAP-[A-Z]+)$/);
          expect(d.candidates.every((c) => !c.allowed)).toBe(true);
          expect(d.candidates.every((c) => c.reasons.length > 0)).toBe(true);
        } else {
          const env = v.env;
          expect(d.candidates.find((c) => c.env === env)!.allowed).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("a job requesting a version that is loaded nowhere is refused with CAP-VERSION", () => {
    const d = new Engine().evaluate({ ...base(), classification: "OPEN", modelVersion: "7.7.7" }, true);
    expect(d.verdict.kind).toBe("REFUSE");
    if (d.verdict.kind === "REFUSE") expect(d.verdict.ruleId).toBe("CAP-VERSION");
  });

  it("dry-run evaluation has no side effects", () => {
    const engine = new Engine();
    const before = engine.snapshot();
    engine.evaluate({ ...base(), classification: "OPEN" }, true);
    engine.evaluate({ ...base(), classification: "SECRET" }, true);
    const after = engine.snapshot();
    expect(after.ledger.length).toBe(before.ledger.length);
    expect(after.decisions.length).toBe(before.decisions.length);
    expect(after.jobs.length).toBe(0);
  });
});

describe("selection", () => {
  it("OPEN prefers cloud on cost and falls back to on-prem when PII is present", () => {
    const engine = new Engine();
    const a = engine.submit({ ...base(), classification: "OPEN" });
    const b = engine.submit({ ...base(), classification: "OPEN", pii: true });
    expect(routedEnv(a)).toBe("cloud");
    expect(routedEnv(b)).toBe("onprem");
  });

  it("queues at on-prem when its four slots are full and promotes on completion", () => {
    const engine = new Engine();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = engine.submit({ ...base(), classification: "RESTRICTED", latency: "batch" });
      expect(r.ok).toBe(true);
      if (r.ok) ids.push(r.job.id);
    }
    const jobs = engine.listJobs();
    expect(jobs.filter((j) => j.status === "RUNNING").length).toBe(4);
    const queued = jobs.find((j) => j.status === "QUEUED")!;
    expect(queued.queuePosition).toBe(1);
    engine.tick(7 * 60_000);
    const after = engine.listJobs();
    expect(after.filter((j) => j.status === "COMPLETED").length).toBe(4);
    expect(after.find((j) => j.id === queued.id)!.status).toBe("RUNNING");
  });
});

describe("input validation", () => {
  it("rejects malformed input without throwing", () => {
    const engine = new Engine();
    for (const bad of [null, 42, "SECRET", [], {}, { title: "" }, { title: "x", classification: "TOP SECRET" }, { title: "x", classification: "OPEN", pii: "yes" }, { title: "x", classification: "OPEN", extra: 1 }, { title: "x", classification: "OPEN", modelVersion: "latest" }]) {
      const r = engine.submit(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    }
    expect(engine.listJobs().length).toBe(0);
  });

  it("never throws for arbitrary JSON (property)", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const r = parseJobInput(raw);
        expect(typeof r.ok).toBe("boolean");
      }),
      { numRuns: 500 },
    );
  });

  it("applies defaults for optional fields", () => {
    const r = parseJobInput({ title: "t", classification: "OPEN" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ pii: false, egress: false, releasability: "MJC", modelVersion: "1.3.0", latency: "interactive" });
  });
});

function routedEnv(r: ReturnType<Engine["submit"]>): string | null {
  if (!r.ok) return null;
  const v = r.decision.verdict;
  return v.kind === "REFUSE" ? null : v.env;
}

function base(): JobInput {
  return { title: "t", summary: "", classification: "OPEN", pii: false, egress: false, releasability: "MJC", modelVersion: "1.3.0", latency: "interactive" };
}
