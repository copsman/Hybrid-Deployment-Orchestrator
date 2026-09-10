import { describe, expect, it } from "vitest";
import { ENVIRONMENTS, ENV_IDS, POLICY, type Classification } from "../../src/engine";
import { NEW_VERSION, SCENARIO_JOBS } from "../../src/engine/scenario";
import { Engine } from "../../src/engine";
import { runScenario } from "../../src/engine/scenario";
import { SCENE_GLYPHS, hasSceneGlyphs, missingSceneGlyphs, NET_LABEL } from "../../src/lib/palette";
import {
  LABELS,
  LAYER_ABBR,
  LAYER_ORDER,
  TRUST_MARK,
  ZONE_WORD,
  bundleRejected,
  bundleTag,
  consoleLabel,
  diodeCounter,
  hubSubtitle,
  layerAbbr,
  ledgerHeadline,
  packetTag,
  plaqueText,
  queueLabel,
  queueOverflow,
  refusedVerdict,
  routedVerdict,
  siteSubtitle,
  stagedCounter,
  zoneBanner,
} from "../../src/components/scene/labels";
import { parseVersionKey } from "../../src/components/scene/selectors";

function expectGlyphs(text: string, what: string) {
  expect(hasSceneGlyphs(text), `${what}: ${JSON.stringify(missingSceneGlyphs(text))} missing from SCENE_GLYPHS in ${JSON.stringify(text)}`).toBe(true);
}

describe("scene labels stay inside the local font's glyph set", () => {
  it("never allows the glyphs GeistMono lacks (they would trigger a CDN font fetch)", () => {
    for (const bad of ["✓", "▮", "▪"]) expect(SCENE_GLYPHS.includes(bad), bad).toBe(false);
    expect(hasSceneGlyphs("CHAIN ✓")).toBe(false);
    expect(missingSceneGlyphs("A ✓ B ▪")).toEqual(["✓", "▪"]);
    for (let c = 0x20; c < 0x7f; c++) expect(SCENE_GLYPHS.includes(String.fromCharCode(c)), `ascii ${c}`).toBe(true);
    for (const ch of "·→×–—") expect(SCENE_GLYPHS.includes(ch), ch).toBe(true);
  });

  it("covers every literal label", () => {
    for (const [k, v] of Object.entries(LABELS)) expectGlyphs(v, `LABELS.${k}`);
    for (const id of ENV_IDS) {
      expectGlyphs(TRUST_MARK[id], `TRUST_MARK.${id}`);
      expectGlyphs(ZONE_WORD[id], `ZONE_WORD.${id}`);
      expectGlyphs(zoneBanner(id, ENVIRONMENTS[id].network), `zoneBanner ${id}`);
    }
    for (const v of Object.values(NET_LABEL)) expectGlyphs(v, "NET_LABEL");
    for (const layer of LAYER_ORDER) {
      expect(LAYER_ABBR[layer], layer).toBeTruthy();
      expectGlyphs(LAYER_ABBR[layer], `LAYER_ABBR.${layer}`);
    }
    expect(layerAbbr("Something new")).toBe("SOMETHING NEW");
  });

  it("covers everything the engine hands the scene: names, stacks, versions, ids, hashes and operators", () => {
    for (const id of ENV_IDS) {
      const spec = ENVIRONMENTS[id];
      expectGlyphs(spec.codename, `${id} codename`);
      expectGlyphs(spec.name, `${id} name`);
      for (const s of spec.stack) {
        expectGlyphs(s.layer, `${id} layer`);
        expectGlyphs(s.name, `${id} stack ${s.layer}`);
      }
      expectGlyphs(siteSubtitle(spec, 0, 0), `${id} subtitle idle`);
      expectGlyphs(siteSubtitle(spec, 3, 2), `${id} subtitle busy`);
    }
    const engine = new Engine();
    runScenario(engine);
    const snap = engine.snapshot();
    for (const j of snap.jobs) expectGlyphs(packetTag(j.id, j.classification), `packet ${j.id}`);
    for (const d of snap.decisions) {
      const v = d.verdict;
      if (v.kind === "REFUSE") expectGlyphs(refusedVerdict(v.ruleId), `refused ${d.id}`);
      else expectGlyphs(routedVerdict(d.jobId, v.env, v.kind === "QUEUE" ? v.position : null), `routed ${d.id}`);
    }
    const ledger = engine.verifyLedger();
    expectGlyphs(ledgerHeadline(ledger.length, ledger.head, ledger.ok), "ledger intact");
    expectGlyphs(ledgerHeadline(1, ledger.head, false), "ledger broken");
    for (const a of snap.artefacts) {
      expectGlyphs(bundleTag(a.version), `bundle ${a.version}`);
      expectGlyphs(bundleRejected(a.version), `rejected ${a.version}`);
      a.approvals.forEach((ap, i) => expectGlyphs(consoleLabel(ap.operator, i, "approved"), `console ${ap.operator}`));
    }
    expectGlyphs(consoleLabel(undefined, 1, "awaiting"), "console fallback");
    expectGlyphs(consoleLabel(undefined, 0, "standby"), "console standby");
    expectGlyphs(hubSubtitle(POLICY.version, snap.decisions.length), "hub subtitle");
    expectGlyphs(hubSubtitle(POLICY.version, 1), "hub subtitle singular");
    expectGlyphs(diodeCounter(null), "diode idle");
    expectGlyphs(diodeCounter({ sent: 16, total: 32, bounces: 1, active: true }), "diode active");
    expectGlyphs(diodeCounter({ sent: 32, total: 32, bounces: 2, active: false }), "diode complete");
    expectGlyphs(stagedCounter(32), "diode staged");
    expectGlyphs(queueLabel(3), "queue label");
    expectGlyphs(queueOverflow(4), "queue overflow");
    for (const cls of ["OPEN", "RESTRICTED", "SECRET", "ONYX"] as Classification[]) expectGlyphs(packetTag("JOB-X", cls), cls);
    expectGlyphs(SCENARIO_JOBS.C.modelVersion, "version");
    expectGlyphs(NEW_VERSION, "new version");
  });

  it("builds plaque lines from the version key with the right tone", () => {
    expect(plaqueText(parseVersionKey("1.3.0:L"))).toEqual({ loaded: "SCRIBE 1.3.0", extra: null, extraTone: null });
    expect(plaqueText(parseVersionKey("1.3.0:L,1.4.0:L"))).toEqual({ loaded: "SCRIBE 1.3.0 · 1.4.0", extra: null, extraTone: null });
    expect(plaqueText(parseVersionKey("1.3.0:L,1.4.0:F"))).toEqual({ loaded: "SCRIBE 1.3.0", extra: "1.4.0 PENDING", extraTone: "amber" });
    expect(plaqueText(parseVersionKey("1.3.0:L,1.4.0:P"))).toEqual({ loaded: "SCRIBE 1.3.0", extra: "1.4.0 PENDING", extraTone: "amber" });
    expect(plaqueText(parseVersionKey("1.3.0:L,1.4.0:X"))).toEqual({ loaded: "SCRIBE 1.3.0", extra: "1.4.0 REJECTED", extraTone: "red" });
    expect(plaqueText(parseVersionKey(""))).toEqual({ loaded: "SCRIBE —", extra: null, extraTone: null });
    for (const key of ["1.3.0:L", "1.3.0:L,1.4.0:F", "1.3.0:L,1.4.0:X", ""]) {
      const t = plaqueText(parseVersionKey(key));
      expectGlyphs(t.loaded, `plaque ${key}`);
      if (t.extra) expectGlyphs(t.extra, `plaque extra ${key}`);
    }
  });

  it("uses only fictional vocabulary", () => {
    const text = [...Object.values(LABELS), ...Object.values(TRUST_MARK), ...Object.values(ZONE_WORD), ...ENV_IDS.map((id) => zoneBanner(id, ENVIRONMENTS[id].network))].join(" ").toLowerCase();
    for (const banned of ["nato", "pentagon", "mod ", "army", "navy", "marine", "air force"]) expect(text.includes(banned), banned).toBe(false);
  });
});
