"use client";

import { useEffect } from "react";
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
import { useOrchestrator } from "@/store/orchestrator";
import { sfx } from "@/lib/sfx";

const TABS = [
  { id: "jobs", label: "JOBS" },
  { id: "decision", label: "DECISION" },
  { id: "deployments", label: "DEPLOYMENTS" },
  { id: "pipeline", label: "PIPELINE" },
  { id: "ledger", label: "LEDGER" },
  { id: "policy", label: "POLICY" },
  { id: "whatif", label: "WHAT-IF" },
] as const;

export function ControlRoom() {
  const status = useDirector((s) => s.status);

  useEffect(() => {
    hydrateDirectorPrefs();
  }, []);

  // Sound hooks: react to store changes, never to raw engine events, so muting is instant.
  useEffect(() => {
    let lastPackets = 0;
    let lastSent = -1;
    let lastBounces = 0;
    return useOrchestrator.subscribe((s) => {
      if (!useDirector.getState().soundOn) {
        lastPackets = s.packets.length;
        lastSent = s.diode?.sent ?? -1;
        lastBounces = s.diode?.bounces ?? 0;
        return;
      }
      if (s.packets.length > lastPackets) {
        const p = s.packets[s.packets.length - 1];
        if (p.to) sfx.route();
        else sfx.refuse();
      }
      lastPackets = s.packets.length;
      if (s.diode && s.diode.sent !== lastSent && s.diode.active) sfx.chunk();
      lastSent = s.diode?.sent ?? -1;
      if (s.diode && s.diode.bounces > lastBounces) sfx.bounce();
      lastBounces = s.diode?.bounces ?? 0;
    });
  }, []);

  useEffect(() => {
    const engine = useOrchestrator.getState().engine;
    return engine.subscribe((e) => {
      if (!useDirector.getState().soundOn) return;
      if (e.type === "artefact.state" && e.state === "LOADED") sfx.verified();
      if (e.type === "artefact.state" && e.state === "REJECTED") sfx.refuse();
    });
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh min-h-[720px] flex-col overflow-hidden bg-background" data-status={status}>
        <TopBar />
        <main className="grid min-h-0 flex-1 grid-cols-12 gap-3 p-3">
          <section className="col-span-12 flex min-h-0 flex-col gap-3 xl:col-span-7">
            <HudFrame className="relative min-h-[380px] flex-1 overflow-hidden" bodyClassName="relative" tone={status === "playing" ? "active" : "default"}>
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

          <aside className="col-span-12 min-h-0 xl:col-span-5">
            <HudFrame className="h-full" bodyClassName="flex min-h-0 flex-col">
              <Tabs defaultValue="jobs" className="flex h-full min-h-0 flex-col gap-0">
                <TabsList className="h-9 w-full justify-start gap-0 rounded-none border-b border-border/60 bg-transparent p-0">
                  {TABS.map((t) => (
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
                <TabsContent value="whatif" className="min-h-0 flex-1 overflow-hidden">
                  <WhatIfPanel />
                </TabsContent>
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
