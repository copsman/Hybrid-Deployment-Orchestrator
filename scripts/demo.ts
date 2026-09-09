/**
 * Headless run of the full MERIDIAN // VANTAGE scenario. No browser, no network.
 *   npm run demo            human-readable tables
 *   npm run demo -- --json  machine-readable snapshot
 * Exit code 0 only if every step succeeded and the ledger verifies.
 */
import { Engine } from "../src/engine";
import { runScenario } from "../src/engine/scenario";
import { whatIf } from "../src/engine/whatif";
import { SCENARIO_JOBS } from "../src/engine/scenario";

const json = process.argv.includes("--json");
const seedArg = process.argv.find((a) => a.startsWith("--seed="));
const engine = new Engine(seedArg ? { seed: Number(seedArg.split("=")[1]) } : {});

const results = runScenario(engine);
const snapshot = engine.snapshot();
const ledger = engine.verifyLedger();
const allOk = results.every((r) => r.results.every((x) => x.ok)) && ledger.ok;

if (json) {
  const out = {
    ok: allOk,
    seed: engine.seed,
    pinnedPublicKey: engine.pinnedPublicKey,
    steps: results.map((r) => ({ id: r.step.id, title: r.step.title, ok: r.results.every((x) => x.ok), summary: r.results[r.results.length - 1].summary })),
    jobs: snapshot.jobs.map((j) => ({ id: j.id, classification: j.classification, status: j.status, environment: j.environment })),
    decisions: snapshot.decisions.map((d) => ({ id: d.id, jobId: d.jobId, verdict: d.verdict, justification: d.justification, ledgerHash: d.ledgerHash })),
    artefacts: snapshot.artefacts.map((a) => ({ version: a.version, digest: a.manifest.manifest.digest, state: a.state, loadedIn: a.loadedIn })),
    ledger: { ...ledger },
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(allOk ? 0 : 1);
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
const line = (n = 96) => "─".repeat(n);

console.log("");
console.log("  MERIDIAN // VANTAGE  ·  Hybrid Deployment Orchestrator  ·  headless scenario");
console.log(`  seed ${engine.seed} · pinned signing key ${engine.pinnedPublicKey.slice(0, 16)}… · sim clock ${snapshot.now}`);
console.log(line());

console.log("  SCENARIO");
for (const r of results) {
  const last = r.results[r.results.length - 1];
  const mark = r.results.every((x) => x.ok) ? "✔" : "✘";
  console.log(`  ${mark} ${pad(r.step.phase, 9)} ${pad(r.step.title, 34)} ${last.summary}`);
}
console.log(line());

console.log("  DECISIONS");
console.log(`  ${pad("job", 8)} ${pad("class", 11)} ${pad("attrs", 22)} ${pad("verdict", 22)} justification`);
for (const d of snapshot.decisions) {
  const attrs = [d.input.pii ? "pii" : null, d.input.egress ? "egress" : null, d.input.releasability !== "MJC" ? d.input.releasability : null, `v${d.input.modelVersion}`]
    .filter(Boolean)
    .join(",");
  const v = d.verdict;
  const verdict = v.kind === "REFUSE" ? `REFUSED ${v.ruleId}` : v.kind === "QUEUE" ? `QUEUED ${v.env} #${v.position}` : `ROUTE → ${v.env}`;
  console.log(`  ${pad(d.jobId, 8)} ${pad(d.input.classification, 11)} ${pad(attrs, 22)} ${pad(verdict, 22)} ${d.justification.slice(0, 110)}${d.justification.length > 110 ? "…" : ""}`);
}
console.log(line());

console.log("  ENVIRONMENTS");
for (const env of snapshot.environments) {
  const slots = env.spec.slots === null ? "elastic" : `${env.running.length}/${env.spec.slots} slots`;
  console.log(`  ${pad(env.spec.codename, 11)} ${pad(env.spec.name, 30)} net=${pad(env.spec.network, 9)} ${pad(slots, 12)} completed=${env.completed} credits=${env.spentCredits} blockedEgress=${env.blockedEgress}`);
}
console.log(line());

console.log("  DEPLOYMENTS (same artefact, three stacks)");
for (const a of snapshot.artefacts) {
  const p = engine.parity(a.version);
  console.log(`  ${a.version}  ${a.manifest.manifest.digest}`);
  console.log(`         cloud=${a.loadedIn.cloud ? "loaded" : "-"} onprem=${a.loadedIn.onprem ? "loaded" : "-"} airgapped=${a.loadedIn.airgapped ? "loaded" : "-"}  parity=${p.consistent ? "CONSISTENT" : "MISSING " + p.missing.join(",")}  state=${a.state}`);
  if (a.transfer) console.log(`         diode ${a.transfer.id}: ${a.transfer.sentChunks}/${a.transfer.totalChunks} chunks, ${a.transfer.returnAttempts} return attempt(s) blocked, approvals ${a.approvals.map((x) => x.operator).join("+")}`);
}
console.log(line());

const wi = whatIf(engine, SCENARIO_JOBS.E);
console.log("  WHAT-IF (Job E: SECRET + live retrieval)");
console.log(`  baseline: ${wi.baseline.justification}`);
for (const s of wi.suggestions) {
  const o = s.outcome;
  console.log(`  → ${s.change}: ${o.kind === "REFUSE" ? "still refused" : `${o.kind} ${o.env}`}`);
}
console.log(line());

console.log(`  LEDGER  ${ledger.ok ? "✔" : "✘"} ${ledger.detail} · head ${ledger.head.slice(0, 24)}…`);
const tamperedAt = engine.tamperLedger();
const broken = engine.verifyLedger();
console.log(`  TAMPER  edited entry #${tamperedAt} → ${broken.ok ? "NOT DETECTED (bug)" : `detected: ${broken.detail}`}`);
engine.restoreLedger();
const restored = engine.verifyLedger();
console.log(`  RESTORE ${restored.ok ? "✔ chain intact again" : "✘ still broken"}`);
console.log(line());
console.log(`  RESULT  ${allOk && !broken.ok && restored.ok ? "ALL CHECKS PASSED" : "FAILURES PRESENT"}`);
console.log("");
process.exit(allOk && !broken.ok && restored.ok ? 0 : 1);
