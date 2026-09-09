"use client";

import { create } from "zustand";
import { Engine, type EngineEvent, type EngineSnapshot, type EnvId, type JobInput, type LedgerVerification, type SubmitResult, type WhatIfReport, type Classification } from "@/engine";
import { whatIf as computeWhatIf } from "@/engine/whatif";
import { drain, isGenerator, type ScenarioStep, type StepResult } from "@/engine/scenario";

export type LogLevel = "info" | "ok" | "warn" | "error" | "sys";

export interface LogLine {
  id: number;
  at: string;
  level: LogLevel;
  text: string;
}

export interface Packet {
  id: string;
  jobId: string;
  classification: Classification;
  /** destination environment, or null when refused at the policy barrier */
  to: EnvId | null;
  bornAt: number;
}

export interface DiodeSignal {
  version: string;
  sent: number;
  total: number;
  /** increments each time the enclave tries to talk back */
  bounces: number;
  active: boolean;
}

interface OrchestratorState {
  engine: Engine;
  snapshot: EngineSnapshot;
  log: LogLine[];
  packets: Packet[];
  diode: DiodeSignal | null;
  ledgerStatus: LedgerVerification;
  ledgerTampered: boolean;
  selectedDecisionId: string | null;
  selectedJobId: string | null;
  selectedVersion: string;
  whatIfReport: WhatIfReport | null;
  activeEnv: EnvId | null;
  alert: { text: string; at: number } | null;

  refresh: () => void;
  submit: (raw: unknown, source?: string) => SubmitResult;
  whatIf: (input: JobInput) => WhatIfReport;
  runStep: (step: ScenarioStep) => StepResult[];
  runStepIncremental: (step: ScenarioStep) => Generator<StepResult, StepResult, void> | StepResult;
  completeRunning: () => void;
  reset: () => void;
  tamperLedger: () => void;
  restoreLedger: () => void;
  verifyLedger: () => LedgerVerification;
  selectDecision: (id: string | null) => void;
  selectJob: (id: string | null) => void;
  selectVersion: (v: string) => void;
  setActiveEnv: (env: EnvId | null) => void;
  appendLog: (level: LogLevel, text: string) => void;
  removePacket: (id: string) => void;
  clearAlert: () => void;
  // manual pipeline controls
  pipeline: {
    build: (version: string) => void;
    publish: (version: string) => void;
    mirror: (version: string) => void;
    stage: (version: string) => void;
    diodeStep: (version: string, chunks?: number) => void;
    attemptReturn: (version: string) => void;
    scan: (version: string) => void;
    approve: (version: string, operator: string) => void;
    verify: (version: string) => void;
    load: (version: string) => void;
    tamper: (version: string, mode: "byte" | "signer") => void;
  };
}

let logSeq = 0;
let packetSeq = 0;

function describeEvent(e: EngineEvent): { level: LogLevel; text: string } | null {
  switch (e.type) {
    case "job.decided": {
      const v = e.decision.verdict;
      if (v.kind === "REFUSE") return { level: "error", text: `${e.job.id} REFUSED · ${v.ruleId} · ${v.reason}` };
      if (v.kind === "QUEUE") return { level: "warn", text: `${e.job.id} QUEUED at ${v.env.toUpperCase()} (#${v.position}) · ${v.tieBreak}` };
      return { level: "ok", text: `${e.job.id} → ${v.env.toUpperCase()} · ${v.tieBreak}` };
    }
    case "job.started":
      return { level: "info", text: `${e.job.id} running on ${e.job.environment?.toUpperCase()} · SCRIBE ${e.job.modelVersion}` };
    case "job.completed":
      return { level: "ok", text: `${e.job.id} completed · ${e.job.outputPreview ?? ""}` };
    case "artefact.state":
      return { level: e.state === "REJECTED" ? "error" : "info", text: `artefact ${e.version} → ${e.state} · ${e.note}` };
    case "diode.progress":
      return e.transfer.completedAt ? { level: "ok", text: `diode ${e.transfer.id} complete · ${e.transfer.totalChunks} chunks` } : null;
    case "egress.blocked":
      return { level: "warn", text: `EGRESS BLOCKED · ${e.env.toUpperCase()} attempted ${e.target}` };
    case "ledger.appended":
      return null;
    case "reset":
      return { level: "sys", text: "sandbox reset · seed restored" };
  }
}

export const useOrchestrator = create<OrchestratorState>()((set, get) => {
  const engine = new Engine();

  const log = (level: LogLevel, text: string) =>
    set((s) => ({ log: [...s.log.slice(-199), { id: ++logSeq, at: get().engine.clock.iso(), level, text }] }));

  engine.subscribe((e) => {
    const line = describeEvent(e);
    if (line) log(line.level, line.text);
    if (e.type === "job.decided") {
      const to = e.decision.verdict.kind === "REFUSE" ? null : e.decision.verdict.env;
      const packet: Packet = { id: `PKT-${++packetSeq}`, jobId: e.job.id, classification: e.job.classification, to, bornAt: Date.now() };
      set((s) => ({
        packets: [...s.packets, packet],
        selectedDecisionId: e.decision.id,
        selectedJobId: e.job.id,
        alert: to === null ? { text: `${e.job.id} refused · ${e.decision.verdict.kind === "REFUSE" ? e.decision.verdict.ruleId : ""}`, at: Date.now() } : s.alert,
      }));
    }
    if (e.type === "diode.progress") {
      set((s) => ({
        diode: { version: e.transfer.version, sent: e.transfer.sentChunks, total: e.transfer.totalChunks, bounces: s.diode?.version === e.transfer.version ? s.diode.bounces : 0, active: e.transfer.completedAt === null },
      }));
    }
    if (e.type === "egress.blocked") {
      set((s) => ({ diode: s.diode ? { ...s.diode, bounces: s.diode.bounces + 1 } : s.diode }));
    }
    if (e.type === "artefact.state") {
      set({ selectedVersion: e.version });
    }
  });

  const refresh = () => set({ snapshot: get().engine.snapshot(), ledgerStatus: get().engine.verifyLedger() });

  const wrap = <A extends unknown[]>(fn: (...a: A) => unknown) =>
    (...a: A) => {
      try {
        fn(...a);
      } catch (err) {
        log("error", err instanceof Error ? err.message : String(err));
      } finally {
        refresh();
      }
    };

  return {
    engine,
    snapshot: engine.snapshot(),
    log: [{ id: ++logSeq, at: engine.clock.iso(), level: "sys", text: "MERIDIAN // VANTAGE control room online · SCRIBE 1.3.0 loaded in all three perimeters" }],
    packets: [],
    diode: null,
    ledgerStatus: engine.verifyLedger(),
    ledgerTampered: false,
    selectedDecisionId: null,
    selectedJobId: null,
    selectedVersion: "1.3.0",
    whatIfReport: null,
    activeEnv: null,
    alert: null,

    refresh,

    submit: (raw, source = "operator") => {
      const r = get().engine.submit(raw);
      if (!r.ok) log("error", `${source}: submission rejected · ${r.errors.join(" · ")}`);
      refresh();
      return r;
    },

    whatIf: (input) => {
      const report = computeWhatIf(get().engine, input);
      set({ whatIfReport: report });
      log("info", `what-if: ${report.baseline.verdict.kind === "REFUSE" ? `refused (${report.baseline.verdict.ruleId}), ${report.suggestions.length} counterfactual(s)` : `would route to ${report.baseline.verdict.env}`}`);
      return report;
    },

    runStep: (step) => {
      const results = drain(get().engine, step);
      refresh();
      return results;
    },

    runStepIncremental: (step) => {
      const out = step.run(get().engine);
      if (!isGenerator(out)) {
        refresh();
        return out;
      }
      const gen: Generator<StepResult, StepResult, void> = out;
      const self = get();
      function* wrapped(): Generator<StepResult, StepResult, void> {
        let r = gen.next();
        while (!r.done) {
          self.refresh();
          yield r.value;
          r = gen.next();
        }
        self.refresh();
        return r.value;
      }
      return wrapped();
    },

    completeRunning: wrap(() => {
      get().engine.tick(10 * 60_000);
    }),

    reset: () => {
      get().engine.reset();
      logSeq = 0;
      set({
        snapshot: get().engine.snapshot(),
        log: [{ id: ++logSeq, at: get().engine.clock.iso(), level: "sys", text: "sandbox reset · SCRIBE 1.3.0 loaded in all three perimeters" }],
        packets: [],
        diode: null,
        ledgerStatus: get().engine.verifyLedger(),
        ledgerTampered: false,
        selectedDecisionId: null,
        selectedJobId: null,
        selectedVersion: "1.3.0",
        whatIfReport: null,
        activeEnv: null,
        alert: null,
      });
    },

    tamperLedger: wrap(() => {
      const seq = get().engine.tamperLedger();
      set({ ledgerTampered: true });
      log("warn", `ledger entry #${seq} edited after the fact (demo) · chain verification should now fail`);
    }),

    restoreLedger: wrap(() => {
      get().engine.restoreLedger();
      set({ ledgerTampered: false });
      log("ok", "ledger restored from pristine copy");
    }),

    verifyLedger: () => {
      const v = get().engine.verifyLedger();
      set({ ledgerStatus: v });
      log(v.ok ? "ok" : "error", `ledger verify · ${v.detail}`);
      return v;
    },

    selectDecision: (id) => set({ selectedDecisionId: id }),
    selectJob: (id) => set({ selectedJobId: id, selectedDecisionId: id ? (get().snapshot.jobs.find((j) => j.id === id)?.decisionId ?? null) : null }),
    selectVersion: (v) => set({ selectedVersion: v }),
    setActiveEnv: (env) => set({ activeEnv: env }),
    appendLog: (level, text) => log(level, text),
    removePacket: (id) => set((s) => ({ packets: s.packets.filter((p) => p.id !== id) })),
    clearAlert: () => set({ alert: null }),

    pipeline: {
      build: wrap((v: string) => {
        get().engine.build(v);
        get().engine.sign(v);
      }),
      publish: wrap((v: string) => get().engine.publish(v)),
      mirror: wrap((v: string) => get().engine.mirror(v)),
      stage: wrap((v: string) => get().engine.stage(v)),
      diodeStep: wrap((v: string, chunks = 2) => get().engine.diodeStep(v, chunks)),
      attemptReturn: wrap((v: string) => get().engine.attemptReturnPath(v, "high-side ACK")),
      scan: wrap((v: string) => get().engine.quarantineScan(v)),
      approve: wrap((v: string, operator: string) => get().engine.approveImport(v, operator)),
      verify: wrap((v: string) => {
        const r = get().engine.verifyImport(v);
        log(r.ok ? "ok" : "error", `import verification ${r.ok ? "passed" : "FAILED"} · ${r.checks.map((c) => `${c.name}:${c.ok ? "ok" : "FAIL"}`).join(" ")}`);
      }),
      load: wrap((v: string) => get().engine.loadInEnclave(v)),
      tamper: wrap((v: string, mode: "byte" | "signer") => {
        get().engine.tamperReceived(v, mode);
        log("warn", `received bundle for ${v} tampered (${mode}) on the high side (demo)`);
      }),
    },
  };
});

/** Convenience selectors */
export const selectDecisions = (s: OrchestratorState) => s.snapshot.decisions;
export const selectJobs = (s: OrchestratorState) => s.snapshot.jobs;
export const selectEnvironments = (s: OrchestratorState) => s.snapshot.environments;
export const selectArtefacts = (s: OrchestratorState) => s.snapshot.artefacts;
