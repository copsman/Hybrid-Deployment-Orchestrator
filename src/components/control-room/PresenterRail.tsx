"use client";

import { StatusLED, type LedTone } from "@/components/shared/StatusLED";
import { useDirector, type DirectorStatus } from "@/store/director";
import type { ScenarioStep } from "@/engine/scenario";
import { cn } from "@/lib/utils";

/** Phase colours: the globals.css tokens (muted-foreground, mjc-cyan, mjc-amber, mjc-red, mjc-green, mjc-violet, foreground). */
const PHASE_HEX: Record<ScenarioStep["phase"], string> = {
  BOOT: "#7e8fa5",
  JOB: "#22d3ee",
  PIPELINE: "#f59e0b",
  DIODE: "#f43f5e",
  IMPORT: "#34d399",
  LEDGER: "#a78bfa",
  WRAP: "#d6e2f0",
};

const LED: Record<DirectorStatus, LedTone> = { idle: "muted", playing: "amber", paused: "cyan", done: "green" };

/** Two tiers of text: the counter always fits, the phase and title join it when the bar is wide enough. */
function useRailText(): { head: string; detail: string } {
  const status = useDirector((s) => s.status);
  const stepIndex = useDirector((s) => s.stepIndex);
  const title = useDirector((s) => s.title);
  const phase = useDirector((s) => (s.stepIndex >= 0 ? s.steps[s.stepIndex]?.phase : undefined));
  const total = useDirector((s) => s.steps.length);
  if (status === "idle") return { head: "STANDBY", detail: "SPACE OR PLAY SCENARIO" };
  if (status === "done") return { head: "END", detail: "SCENARIO COMPLETE" };
  const head = `${status === "paused" ? "PAUSED · " : ""}STEP ${String(stepIndex + 1).padStart(2, "0")}/${total}`;
  const detail = [phase, title?.toUpperCase()].filter(Boolean).join(" · ");
  return { head, detail };
}

/**
 * The presenter HUD in the top bar: director LED, step counter with phase and title, and one
 * segment per scenario step coloured by phase (done 0.8 · current 1 with glow · upcoming 0.22).
 * Re-renders only on the director primitives it selects; no per-frame work.
 */
export function PresenterRail() {
  const status = useDirector((s) => s.status);
  const stepIndex = useDirector((s) => s.stepIndex);
  const steps = useDirector((s) => s.steps);
  const speed = useDirector((s) => s.speed);
  const { head, detail } = useRailText();
  const full = detail ? `${head} · ${detail}` : head;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5" data-testid="presenter-rail" data-step={stepIndex} data-status={status} title={`DIRECTOR · ${full} · ${speed}×`}>
      <StatusLED tone={LED[status]} pulse={status === "playing"} />
      <span className="hud-label hidden xl:inline">DIRECTOR</span>
      <span className={cn("hidden min-w-0 truncate font-mono text-[10px] tracking-[0.18em] xl:inline", status === "idle" ? "text-muted-foreground" : "text-foreground/90")}>
        {head}
        {detail && <span className="hidden 2xl:inline"> · {detail}</span>}
      </span>
      <div className="flex w-[124px] shrink-0 gap-[2px]" aria-hidden>
        {steps.map((step, i) => {
          const hex = PHASE_HEX[step.phase];
          const current = i === stepIndex;
          return (
            <span
              key={step.id}
              title={`${i + 1} · ${step.phase} · ${step.title}`}
              className="h-1.5 flex-1 rounded-[1px] transition-opacity duration-300"
              style={{ background: hex, opacity: i < stepIndex ? 0.8 : current ? 1 : 0.22, boxShadow: current ? `0 0 8px ${hex}` : undefined }}
            />
          );
        })}
      </div>
      <span className="hud-label hidden shrink-0 2xl:inline">{speed}×</span>
    </div>
  );
}

/** Below lg the rail has no room: the old DIRECTOR pill text stands in for it. */
export function PresenterPill() {
  const status = useDirector((s) => s.status);
  const { head } = useRailText();
  return (
    <div className="hidden items-center gap-2 whitespace-nowrap md:flex lg:hidden">
      <StatusLED tone={LED[status]} pulse={status === "playing"} />
      <span className="hud-label">DIRECTOR</span>
      <span className="font-mono text-[11px] tracking-wider text-foreground/90">{head}</span>
    </div>
  );
}
