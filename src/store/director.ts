"use client";

import { create } from "zustand";
import { SCENARIO, isGenerator, type Focus, type ScenarioStep, type StepResult } from "@/engine/scenario";
import { useOrchestrator } from "./orchestrator";

export type DirectorStatus = "idle" | "playing" | "paused" | "done";
export type Speed = 0.5 | 1 | 2 | 4;

/** Playback speeds in cycling order; shared by the top bar and the presenter hotkeys. */
export const SPEEDS: Speed[] = [0.5, 1, 2, 4];

export type CameraHandler = (focus: Focus, animate: boolean) => Promise<void> | void;

export interface DirectorState {
  status: DirectorStatus;
  stepIndex: number;
  steps: ScenarioStep[];
  speed: Speed;
  caption: string | null;
  title: string | null;
  focus: Focus;
  reducedMotion: boolean;
  soundOn: boolean;
  /** cinematic intro overlay; false during SSR, decided on the client */
  intro: boolean;
  /** ?jury=1 or the J key: hides the manual controls for a presentation (not persisted) */
  jury: boolean;
  /** the presenter-keys legend dialog */
  legendOpen: boolean;
  lastResult: StepResult | null;
  runId: number;

  play: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  next: () => void;
  stop: () => void;
  setSpeed: (s: Speed) => void;
  setReducedMotion: (v: boolean) => void;
  toggleSound: () => void;
  setFocus: (f: Focus) => void;
  registerCamera: (fn: CameraHandler | null) => void;
  dismissIntro: () => void;
  setJury: (v: boolean) => void;
  toggleJury: () => void;
  setLegendOpen: (v: boolean) => void;
}

let camera: CameraHandler | null = null;
let skipResolver: (() => void) | null = null;
let pauseGate: Promise<void> | null = null;
let pauseRelease: (() => void) | null = null;
/**
 * Set by next(): the rest of the current step's waits are skipped, so one press jumps to the
 * next step. Consumed at the top of every loop iteration and cleared on stop() and completion.
 */
let skipRequested = false;

function readPref(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) {
      if (key === "mjc.reducedMotion") return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return fallback;
    }
    return v === "1";
  } catch {
    return fallback;
  }
}

function writePref(key: string, v: boolean) {
  try {
    window.localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* storage unavailable: preference lives for the session only */
  }
}

export const useDirector = create<DirectorState>()((set, get) => {
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        skipResolver = null;
        resolve();
      }, ms);
      skipResolver = () => {
        clearTimeout(t);
        skipResolver = null;
        resolve();
      };
    });

  const gate = async () => {
    if (pauseGate) await pauseGate;
  };

  const flyTo = async (focus: Focus) => {
    set({ focus });
    if (camera) {
      try {
        await camera(focus, !get().reducedMotion);
      } catch {
        /* camera not ready */
      }
    }
  };

  return {
    status: "idle",
    stepIndex: -1,
    steps: SCENARIO,
    speed: 1,
    caption: null,
    title: null,
    focus: "overview",
    reducedMotion: false,
    soundOn: false,
    intro: false,
    jury: false,
    legendOpen: false,
    lastResult: null,
    runId: 0,

    play: async () => {
      const state = get();
      if (state.status === "playing") return;
      if (state.status === "paused") {
        state.resume();
        return;
      }
      const runId = state.runId + 1;
      const orchestrator = useOrchestrator.getState();
      orchestrator.reset();
      orchestrator.appendLog("sys", "director: scenario start");
      set({ status: "playing", stepIndex: -1, runId, caption: null, lastResult: null });
      skipRequested = false;

      for (let i = 0; i < SCENARIO.length; i++) {
        if (get().runId !== runId || get().status === "idle") return;
        // One skip consumes one step: a press during the previous hold never leaks into this one.
        skipRequested = false;
        const step = SCENARIO[i];
        set({ stepIndex: i, caption: step.caption, title: step.title });
        await gate();
        await flyTo(step.focus);
        await gate();
        if (get().runId !== runId) return;

        const speed = get().speed;
        const out = useOrchestrator.getState().runStepIncremental(step);
        let last: StepResult;
        if (isGenerator(out)) {
          let r = out.next();
          while (!r.done) {
            set({ lastResult: r.value });
            // A skip drains the remaining frames synchronously (the engine is synchronous and
            // deterministic, and refresh() still runs per frame), so the last frame shows 32/32.
            if (!skipRequested) {
              await wait((r.value.bounced ? 1400 : 260) / speed);
              await gate();
              if (get().runId !== runId) return;
            }
            r = out.next();
          }
          last = r.value;
        } else {
          last = out;
        }
        set({ lastResult: last });
        useOrchestrator.getState().appendLog(last.ok ? "sys" : "error", `director: ${step.title} · ${last.summary}`);
        if (!skipRequested) await wait(step.holdMs / get().speed);
        await gate();
      }
      if (get().runId === runId) {
        skipRequested = false;
        set({ status: "done", caption: "SCENARIO COMPLETE · three jobs routed, three refused, artefact parity verified, ledger intact.", title: "Scenario complete" });
        useOrchestrator.getState().appendLog("sys", "director: SCENARIO COMPLETE");
        await flyTo("overview");
      }
    },

    pause: () => {
      if (get().status !== "playing") return;
      pauseGate = new Promise<void>((resolve) => {
        pauseRelease = resolve;
      });
      set({ status: "paused" });
    },

    resume: () => {
      if (get().status !== "paused") return;
      pauseRelease?.();
      pauseGate = null;
      pauseRelease = null;
      set({ status: "playing" });
    },

    /**
     * Jump to the next step. During a hold the hold ends; during the diode transfer the remaining
     * chunks are drained at once; during a camera flight the flight lands first and the step's
     * hold is then skipped.
     */
    next: () => {
      const status = get().status;
      if (status !== "playing" && status !== "paused") return;
      if (status === "paused") get().resume();
      skipRequested = true;
      skipResolver?.();
    },

    stop: () => {
      pauseRelease?.();
      pauseGate = null;
      pauseRelease = null;
      skipRequested = false;
      skipResolver?.();
      set({ status: "idle", stepIndex: -1, caption: null, title: null, lastResult: null, runId: get().runId + 1, focus: "overview" });
      void flyTo("overview");
    },

    setSpeed: (speed) => set({ speed }),

    setReducedMotion: (v) => {
      writePref("mjc.reducedMotion", v);
      set({ reducedMotion: v });
    },

    toggleSound: () => {
      const v = !get().soundOn;
      writePref("mjc.sound", v);
      set({ soundOn: v });
    },

    setFocus: (focus) => {
      void flyTo(focus);
    },

    registerCamera: (fn) => {
      camera = fn;
    },

    dismissIntro: () => set({ intro: false }),

    setJury: (v) => set({ jury: v }),

    toggleJury: () => set({ jury: !get().jury }),

    setLegendOpen: (v) => set({ legendOpen: v }),
  };
});

/** Call once on the client after mount to load persisted preferences without a hydration mismatch. */
export function hydrateDirectorPrefs() {
  let intro = true;
  let speed: Speed = 1;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("intro") === "0") intro = false;
    const sp = Number(params.get("speed"));
    if (sp === 0.5 || sp === 1 || sp === 2 || sp === 4) speed = sp;
  } catch {
    /* no window */
  }
  const reducedMotion = readPref("mjc.reducedMotion", false);
  useDirector.setState({ reducedMotion, soundOn: readPref("mjc.sound", false), intro: intro && !reducedMotion, speed });
}
