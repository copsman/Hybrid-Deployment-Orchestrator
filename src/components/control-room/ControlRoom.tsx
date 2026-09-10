"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HudFrame } from "@/components/shared/HudFrame";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { TopBar } from "./TopBar";
import { EnvCards } from "./EnvCards";
import { JobsPanel } from "./JobsPanel";
import { DecisionTrace } from "./DecisionTrace";
import { DeploymentsMatrix } from "./DeploymentsMatrix";
import { PipelineTracer } from "./PipelineTracer";
import { LedgerPanel } from "./LedgerPanel";
import { PolicyPanel } from "./PolicyPanel";
import { WhatIfPanel } from "./WhatIfPanel";
import { LogTicker } from "./LogTicker";
import { Captions } from "./Captions";
import { AlertOverlay } from "./AlertOverlay";
import { IntroOverlay } from "./IntroOverlay";
import { ImportCeremony } from "./ImportCeremony";
import { Hotkeys } from "./Hotkeys";
import { ShortcutLegend } from "./ShortcutLegend";
import { useDirector, hydrateDirectorPrefs } from "@/store/director";
import { bindSfx } from "@/lib/sfx-bindings";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "jobs", label: "JOBS" },
  { id: "decision", label: "DECISION" },
  { id: "deployments", label: "DEPLOYMENTS" },
  { id: "pipeline", label: "PIPELINE" },
  { id: "ledger", label: "LEDGER" },
  { id: "policy", label: "POLICY" },
  { id: "whatif", label: "WHAT-IF" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Jury view only: the tab that tells each scenario step's story. A manual click sticks until the mapped tab changes. */
const TAB_FOR_STEP: Record<string, TabId> = {
  boot: "jobs",
  "job-a": "decision",
  "job-b": "decision",
  "job-c-first": "decision",
  build: "pipeline",
  publish: "pipeline",
  mirror: "pipeline",
  stage: "pipeline",
  diode: "pipeline",
  scan: "pipeline",
  approve: "pipeline",
  verify: "pipeline",
  parity: "deployments",
  "job-c-second": "decision",
  "job-d": "decision",
  "job-e": "decision",
  complete: "jobs",
  ledger: "ledger",
};

export function ControlRoom() {
  const status = useDirector((s) => s.status);
  const jury = useDirector((s) => s.jury);
  const [tab, setTab] = useState<TabId>("jobs");
  // Mirrors `tab` for the store subscription below, so it never reads a stale closure value.
  const tabRef = useRef<TabId>("jobs");
  const selectTab = useCallback((v: TabId) => {
    tabRef.current = v;
    setTab(v);
  }, []);

  useEffect(() => {
    hydrateDirectorPrefs();
  }, []);

  // Story auto-follow, jury view only. All setState calls live inside the subscription callback.
  useEffect(() => {
    let prev: TabId | null = null;
    return useDirector.subscribe((s, p) => {
      if (!s.jury) return;
      // The WHAT-IF tab is not rendered in the jury view: a hidden tab cannot stay selected.
      if (!p.jury && tabRef.current === "whatif") selectTab("jobs");
      if (s.stepIndex === p.stepIndex) return;
      const id = s.stepIndex >= 0 ? s.steps[s.stepIndex]?.id : undefined;
      const mapped = id ? (TAB_FOR_STEP[id] ?? null) : null;
      if (mapped && mapped !== prev) selectTab(mapped);
      prev = mapped;
    });
  }, [selectTab]);

  // Sound: store-driven bindings (never raw engine events), so muting is instant.
  useEffect(() => bindSfx(), []);

  // Everything the jury switch changes derives from this one read, so the layout flips in a single paint.
  const tabs = jury ? TABS.filter((t) => t.id !== "whatif") : TABS;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh min-h-[720px] flex-col overflow-hidden bg-background" data-status={status} data-jury={jury ? "1" : "0"}>
        <TopBar />
        <main className={cn("grid min-h-0 flex-1 grid-cols-12", jury ? "gap-2 p-2" : "gap-3 p-3")}>
          <section className={cn("col-span-12 flex min-h-0 flex-col", jury ? "gap-2 xl:col-span-8" : "gap-3 xl:col-span-7")}>
            <HudFrame className={cn("relative flex-1 overflow-hidden", jury ? "min-h-[460px]" : "min-h-[380px]")} bodyClassName="relative" tone={status === "playing" ? "active" : "default"}>
              <div className="absolute inset-0">
                <SceneCanvas />
              </div>
              <AlertOverlay />
              <ImportCeremony />
              <Captions />
              <div className="pointer-events-none absolute right-3 top-3 hud-label rounded-sm border border-border/60 bg-background/70 px-2 py-1">
                SCRIBE · mjc/scribe-8b · three perimeters
              </div>
            </HudFrame>
            <EnvCards />
          </section>

          <aside className={cn("col-span-12 min-h-0", jury ? "xl:col-span-4" : "xl:col-span-5")}>
            <HudFrame className="h-full" bodyClassName="flex min-h-0 flex-col">
              <Tabs value={tab} onValueChange={(v) => selectTab(v as TabId)} className="flex h-full min-h-0 flex-col gap-0">
                <TabsList className="h-9 w-full justify-start gap-0 rounded-none border-b border-border/60 bg-transparent p-0">
                  {tabs.map((t) => (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      data-testid={`tab-${t.id}`}
                      className="h-9 flex-1 rounded-none border-b-2 border-transparent font-mono text-[10px] tracking-[0.16em] text-muted-foreground data-[state=active]:border-mjc-cyan data-[state=active]:bg-mjc-cyan/5 data-[state=active]:text-mjc-cyan data-[state=active]:shadow-none"
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="jobs" className="min-h-0 flex-1 overflow-hidden">
                  <JobsPanel />
                </TabsContent>
                <TabsContent value="decision" className="min-h-0 flex-1 overflow-hidden">
                  <DecisionTrace />
                </TabsContent>
                <TabsContent value="deployments" className="min-h-0 flex-1 overflow-hidden">
                  <DeploymentsMatrix />
                </TabsContent>
                <TabsContent value="pipeline" className="min-h-0 flex-1 overflow-hidden">
                  <PipelineTracer />
                </TabsContent>
                <TabsContent value="ledger" className="min-h-0 flex-1 overflow-hidden">
                  <LedgerPanel />
                </TabsContent>
                <TabsContent value="policy" className="min-h-0 flex-1 overflow-hidden">
                  <PolicyPanel />
                </TabsContent>
                {!jury && (
                  <TabsContent value="whatif" className="min-h-0 flex-1 overflow-hidden">
                    <WhatIfPanel />
                  </TabsContent>
                )}
              </Tabs>
            </HudFrame>
          </aside>
        </main>
        <LogTicker />
        <IntroOverlay />
        <Hotkeys />
        <ShortcutLegend />
      </div>
    </TooltipProvider>
  );
}
