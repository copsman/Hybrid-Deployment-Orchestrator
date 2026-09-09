"use client";

import { motion } from "motion/react";
import { Globe, Shield, ShieldBan } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusLED } from "@/components/shared/StatusLED";
import { StackIcon, ENV_ICON } from "@/components/shared/icons";
import { GlowingEffect } from "@/components/aceternity/glowing-effect";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import type { EnvId, EnvironmentRuntime } from "@/engine";
import { cn } from "@/lib/utils";

const NET_BADGE: Record<EnvironmentRuntime["spec"]["network"], { icon: typeof Globe; cls: string; text: string }> = {
  EXTERNAL: { icon: Globe, cls: "text-mjc-cyan border-mjc-cyan/50", text: "EXTERNAL" },
  PROXIED: { icon: Shield, cls: "text-mjc-amber border-mjc-amber/50", text: "PROXIED" },
  NONE: { icon: ShieldBan, cls: "text-mjc-red border-mjc-red/50", text: "NO EGRESS" },
};

export function EnvCards() {
  const environments = useOrchestrator((s) => s.snapshot.environments);
  const artefacts = useOrchestrator((s) => s.snapshot.artefacts);
  const focus = useDirector((s) => s.focus);
  const setFocus = useDirector((s) => s.setFocus);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="env-cards">
      {environments.map((env) => {
        const id = env.spec.id as EnvId;
        const Icon = ENV_ICON[id];
        const net = NET_BADGE[env.spec.network];
        const used = env.running.length;
        const cap = env.spec.slots;
        const pct = cap === null ? Math.min(100, used * 12) : (used / cap) * 100;
        const loaded = artefacts.filter((a) => a.loadedIn[id]).map((a) => a.version);
        const active = focus === id;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => setFocus(id)}
            layout
            className={cn(
              "group relative overflow-hidden rounded-md border bg-card/70 p-3 text-left backdrop-blur-sm transition-colors",
              active ? "border-mjc-cyan/70 shadow-[0_0_28px_rgba(34,211,238,0.14)]" : "border-border/80 hover:border-border",
            )}
            data-testid={`env-card-${id}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-40" />
            <GlowingEffect spread={32} proximity={72} inactiveZone={0.2} borderWidth={1.5} />
            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn("grid size-8 place-items-center rounded-sm border", active ? "border-mjc-cyan/60 bg-mjc-cyan/10 text-mjc-cyan" : "border-border bg-secondary text-foreground/80")}>
                    <Icon className="size-4" />
                  </span>
                  <div className="leading-tight">
                    <div className="font-mono text-[11px] tracking-[0.24em] text-foreground">{env.spec.codename}</div>
                    <div className="text-xs text-muted-foreground">{env.spec.name}</div>
                  </div>
                </div>
                <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em]", net.cls)}>
                  <net.icon className="size-3" /> {net.text}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]">
                <Stat label={cap === null ? "ELASTIC" : "CAPACITY"} value={cap === null ? `${used} running` : `${used}/${cap} GPU`} />
                <Stat label="QUEUE" value={String(env.queue.length)} tone={env.queue.length ? "amber" : undefined} />
                <Stat label="CREDITS" value={env.spentCredits.toFixed(1)} />
              </div>
              <Progress value={pct} className={cn("mt-2 h-1 bg-secondary", cap !== null && used >= cap ? "[&>div]:bg-mjc-amber" : "[&>div]:bg-mjc-cyan")} />

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="hud-label mr-1">SCRIBE</span>
                  {loaded.length ? (
                    loaded.map((v) => (
                      <span key={v} className="rounded-sm border border-mjc-green/50 bg-mjc-green/10 px-1.5 font-mono text-[10px] text-mjc-green">
                        {v}
                      </span>
                    ))
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground">none</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusLED tone={env.blockedEgress > 0 && id === "airgapped" ? "amber" : "green"} pulse={used > 0} />
                  <span className="hud-label">{used > 0 ? "BUSY" : "ONLINE"}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1 border-t border-border/50 pt-2">
                {env.spec.stack.map((c) => (
                  <Tooltip key={c.layer}>
                    <TooltipTrigger asChild>
                      <span className="grid size-6 place-items-center rounded-sm border border-border/70 bg-secondary/60 text-muted-foreground transition-colors group-hover:text-foreground/90">
                        <StackIcon name={c.icon} className="size-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-56">
                      <div className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">{c.layer.toUpperCase()}</div>
                      <div className="text-xs font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">{c.detail}</div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/40 px-2 py-1">
      <div className="hud-label">{label}</div>
      <div className={cn("mt-0.5 text-[11px] text-foreground", tone === "amber" && "text-mjc-amber")}>{value}</div>
    </div>
  );
}
