import { describe, expect, it } from "vitest";
import { Engine } from "../../src/engine";
import { runScenario, SCENARIO, SCENARIO_JOBS } from "../../src/engine/scenario";
import { whatIf } from "../../src/engine/whatif";

describe("scenario", () => {
  it("completes every step and lands each job where the brief says", () => {
    const engine = new Engine();
    const results = runScenario(engine);
    for (const r of results) {
      for (const x of r.results) expect(x.ok, `${r.step.id}: ${x.summary}`).toBe(true);
    }
    const byId = Object.fromEntries(engine.listJobs().map((j) => [j.id, j]));
    expect(byId["JOB-A"].environment).toBe("cloud");
    expect(byId["JOB-B"].environment).toBe("onprem");
    expect(byId["JOB-C"].status).toBe("REFUSED");
    expect(byId["JOB-C2"].environment).toBe("airgapped");
    expect(byId["JOB-D"].status).toBe("REFUSED");
    expect(byId["JOB-E"].status).toBe("REFUSED");
    expect(["JOB-A", "JOB-B", "JOB-C2"].every((id) => byId[id].status === "COMPLETED")).toBe(true);
    const refusals = engine.listDecisions().filter((d) => d.verdict.kind === "REFUSE").map((d) => (d.verdict.kind === "REFUSE" ? d.verdict.ruleId : ""));
    expect(refusals).toEqual(["CAP-VERSION", "POL-01", "POL-03"]);
    expect(engine.parity("1.4.0").consistent).toBe(true);
    expect(engine.verifyLedger().ok).toBe(true);
  });

  it("is deterministic: two fresh runs produce identical ledgers", () => {
    const a = new Engine();
    const b = new Engine();
    runScenario(a);
    runScenario(b);
    expect(a.verifyLedger().head).toBe(b.verifyLedger().head);
    expect(a.snapshot().decisions.map((d) => d.ledgerHash)).toEqual(b.snapshot().decisions.map((d) => d.ledgerHash));
  });

  it("survives a second run on the same engine after reset", () => {
    const engine = new Engine();
    runScenario(engine);
    const head1 = engine.verifyLedger().head;
    engine.reset();
    expect(engine.listJobs().length).toBe(0);
    runScenario(engine);
    expect(engine.verifyLedger().head).toBe(head1);
  });

  it("has unique step ids and captions free of real-world military names", () => {
    expect(new Set(SCENARIO.map((s) => s.id)).size).toBe(SCENARIO.length);
    const text = SCENARIO.map((s) => s.caption + s.title).join(" ").toLowerCase();
    for (const banned of ["nato", "pentagon", "mod ", "army", "navy", "marine", "air force"]) {
      expect(text.includes(banned), banned).toBe(false);
    }
  });

  it("what-if explains how a refused job could become routable", () => {
    const engine = new Engine();
    const e = whatIf(engine, SCENARIO_JOBS.E);
    expect(e.baseline.verdict.kind).toBe("REFUSE");
    expect(e.suggestions.some((s) => s.field === "egress" && s.outcome.kind === "ROUTE" && s.outcome.env === "airgapped")).toBe(true);
    const d = whatIf(engine, SCENARIO_JOBS.D);
    expect(d.suggestions.every((s) => s.field === "classification")).toBe(true);
    const ok = whatIf(engine, SCENARIO_JOBS.A);
    expect(ok.suggestions).toEqual([]);
    expect(engine.listJobs().length).toBe(0);
  });
});
