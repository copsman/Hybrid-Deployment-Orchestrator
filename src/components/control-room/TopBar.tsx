"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Square, Volume2, VolumeX, Film, Gauge, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusLED, type LedTone } from "@/components/shared/StatusLED";
import { useDirector, SPEEDS } from "@/store/director";
import { useOrchestrator } from "@/store/orchestrator";
import { cn } from "@/lib/utils";
import { MovingBorderBadge } from "@/components/aceternity/moving-border";
import { PresenterRail, PresenterPill } from "./PresenterRail";

export function TopBar() {
  const status = useDirector((s) => s.status);
  const speed = useDirector((s) => s.speed);
  const reducedMotion = useDirector((s) => s.reducedMotion);
  const soundOn = useDirector((s) => s.soundOn);
  const jury = useDirector((s) => s.jury);
  const { play, pause, resume, next, stop, setSpeed, setReducedMotion, toggleSound, setLegendOpen } = useDirector.getState();
  const simNow = useOrchestrator((s) => s.snapshot.now);
  const ledgerOk = useOrchestrator((s) => s.ledgerStatus.ok);
  const reset = useOrchestrator((s) => s.reset);

  return (
    <header className="relative z-20 flex h-12 items-center justify-between gap-4 border-b border-border/80 bg-background/80 px-3 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid size-7 place-items-center rounded-sm border border-mjc-cyan/60 bg-mjc-cyan/10 text-mjc-cyan">
            <Film className="size-3.5" />
          </span>
          <div className="leading-none">
            <div className="whitespace-nowrap font-mono text-[13px] font-semibold tracking-[0.28em] text-foreground text-glow">MERIDIAN <span className="text-mjc-cyan">{"//"}</span> VANTAGE</div>
            <div className="hud-label mt-0.5 whitespace-nowrap">Hybrid Deployment Orchestrator <span className="hidden 2xl:inline">· Meridian Joint Command</span></div>
          </div>
        </div>
        <span className="mx-1 hidden h-6 w-px shrink-0 bg-border md:block" />
        <PresenterPill />
        <div className="hidden min-w-0 flex-1 items-center gap-4 overflow-hidden lg:flex">
          <Pill led={ledgerOk ? "green" : "red"} label="LEDGER" value={ledgerOk ? "INTACT" : "BROKEN"} />
          <Pill led="cyan" label="POLICY" value="MJC-ROUTING 2031.03" className="hidden 2xl:flex" />
          {jury && <Pill led="violet" label="VIEW" value="JURY" />}
          <PresenterRail />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Clock simNow={simNow} />
        <span className="mx-1 h-6 w-px bg-border" />
        {status === "idle" || status === "done" ? (
          <MovingBorderBadge duration={2800} className="bg-transparent border-0" containerClassName="rounded-md">
            <Button size="sm" onClick={() => void play()} data-testid="play-scenario" className="gap-1.5 bg-mjc-cyan font-mono text-[11px] tracking-[0.18em] text-primary-foreground hover:bg-mjc-cyan/90">
              <Play className="size-3.5" /> {status === "done" ? "REPLAY" : "PLAY SCENARIO"}
            </Button>
          </MovingBorderBadge>
        ) : status === "playing" ? (
          <Button size="sm" variant="secondary" onClick={pause} className="gap-1.5 font-mono text-[11px] tracking-[0.18em]">
            <Pause className="size-3.5" /> PAUSE
          </Button>
        ) : (
          <Button size="sm" onClick={resume} className="gap-1.5 bg-mjc-cyan font-mono text-[11px] tracking-[0.18em] text-primary-foreground hover:bg-mjc-cyan/90">
            <Play className="size-3.5" /> RESUME
          </Button>
        )}
        {/* Jury view keeps play/pause, sound, the keys button and the 2D switch; the rest is presenter-keys only. */}
        {!jury && (
          <>
            <IconBtn label="Next step (N)" onClick={next} disabled={status === "idle" || status === "done"}>
              <SkipForward className="size-3.5" />
            </IconBtn>
            <IconBtn label="Stop scenario" onClick={stop} disabled={status === "idle"}>
              <Square className="size-3.5" />
            </IconBtn>
            <IconBtn
              label={`Playback speed ${speed}x (+ / −)`}
              onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            >
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Gauge className="size-3.5" />
                {speed}x
              </span>
            </IconBtn>
            <IconBtn
              label="Reset sandbox (same seed, identical second run) · SHIFT+R"
              onClick={() => {
                stop();
                reset();
              }}
              data-testid="reset"
            >
              <RotateCcw className="size-3.5" />
            </IconBtn>
          </>
        )}
        <IconBtn label={soundOn ? "Mute (S)" : "Sound on (S)"} onClick={toggleSound}>
          {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
        </IconBtn>
        <IconBtn label="Keyboard shortcuts (?)" onClick={() => setLegendOpen(true)}>
          <Keyboard className="size-3.5" />
        </IconBtn>
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="ml-1 flex cursor-pointer items-center gap-2">
              <span className="hud-label">2D</span>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} aria-label="Reduced motion / 2D map" data-testid="motion-toggle" />
            </label>
          </TooltipTrigger>
          <TooltipContent>Reduced motion: swaps the 3D scene for a 2D map and disables camera flights (M).</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function Pill({ led, label, value, pulse, className }: { led: LedTone; label: string; value: string; pulse?: boolean; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2 whitespace-nowrap", className)}>
      <StatusLED tone={led} pulse={pulse} />
      <span className="hud-label">{label}</span>
      <span className={cn("font-mono text-[11px] tracking-wider", led === "red" ? "text-mjc-red" : "text-foreground/90")}>{value}</span>
    </div>
  );
}

function IconBtn({ label, children, ...props }: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Clock({ simNow }: { simNow: string }) {
  const [wall, setWall] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setWall(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden whitespace-nowrap text-right font-mono leading-none lg:block">
      <div className="text-[11px] tracking-[0.2em] text-foreground/90">{wall ?? "--:--:--"}<span className="text-muted-foreground">Z</span></div>
      <div className="hud-label mt-0.5">
        SIM {simNow.slice(11, 19)}Z<span className="hidden 2xl:inline"> · {simNow.slice(0, 10)}</span>
      </div>
    </div>
  );
}
