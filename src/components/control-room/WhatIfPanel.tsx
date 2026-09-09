"use client";

import { FlaskConical, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrchestrator } from "@/store/orchestrator";
import { DecisionBody } from "./DecisionTrace";
import { cn } from "@/lib/utils";

export function WhatIfPanel() {
  const report = useOrchestrator((s) => s.whatIfReport);
  if (!report) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-xs text-muted-foreground">
        <FlaskConical className="size-6 text-mjc-cyan/70" />
        <p>
          What-if runs the policy without dispatching, then tries single-attribute changes to explain how a refused job could become routable. Fill the form in JOBS and press WHAT-IF.
        </p>
      </div>
    );
  }
  const b = report.baseline.verdict;
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-3" data-testid="whatif-panel">
        <div className="rounded-md border border-mjc-cyan/40 bg-mjc-cyan/5 p-3">
          <div className="hud-label text-mjc-cyan">Dry run · nothing was dispatched or recorded</div>
          <div className="mt-1 text-sm text-foreground/90">{report.baseline.justification}</div>
        </div>
        {b.kind === "REFUSE" && (
          <div>
            <div className="hud-label mb-1.5">Counterfactuals · one change at a time</div>
            {report.suggestions.length === 0 ? (
              <div className="rounded-sm border border-border/60 p-3 text-xs text-muted-foreground">No single change makes this job routable. The request itself needs to change.</div>
            ) : (
              <ul className="space-y-1.5">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-sm border border-border/70 bg-secondary/40 px-2 py-2 text-xs">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-mjc-cyan" />
                    <div className="flex-1">
                      <div className="text-foreground/90">{s.change}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        set <span className="text-foreground/80">{String(s.field)}</span> = <span className="text-foreground/80">{String(s.value)}</span>
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em]", s.outcome.kind === "REFUSE" ? "border-mjc-red/50 text-mjc-red" : "border-mjc-green/50 text-mjc-green")}>
                      {s.outcome.kind === "REFUSE" ? "STILL REFUSED" : `${s.outcome.kind} ${s.outcome.env.toUpperCase()}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="border-t border-border/60 pt-2">
          <div className="hud-label mb-1">Baseline record</div>
          <div className="-mx-3">
            <DecisionBody decision={report.baseline} />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
