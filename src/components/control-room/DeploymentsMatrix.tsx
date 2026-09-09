"use client";

import { Check, X, Layers, BadgeCheck, TriangleAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StackIcon, ENV_ICON } from "@/components/shared/icons";
import { useOrchestrator } from "@/store/orchestrator";
import { ENVIRONMENTS, ENV_ORDER, short, type ArtefactState, type ArtefactVersion, type EnvId } from "@/engine";
import { cn } from "@/lib/utils";

function cellState(a: ArtefactVersion, env: EnvId): { label: string; tone: string } {
  if (a.loadedIn[env]) return { label: "LOADED", tone: "border-mjc-green/50 bg-mjc-green/10 text-mjc-green" };
  if (a.presentIn[env]) return { label: "PRESENT", tone: "border-mjc-cyan/50 bg-mjc-cyan/10 text-mjc-cyan" };
  if (a.state === "REJECTED" && env === "airgapped") return { label: "REJECTED", tone: "border-mjc-red/50 bg-mjc-red/10 text-mjc-red" };
  const pending: ArtefactState[] = ["STAGED", "IN_DIODE", "QUARANTINE", "VERIFYING", "IMPORTED"];
  if (env === "airgapped" && pending.includes(a.state)) return { label: a.state === "IN_DIODE" ? "IN DIODE" : a.state, tone: "border-mjc-amber/50 bg-mjc-amber/10 text-mjc-amber" };
  return { label: "—", tone: "border-border/50 text-muted-foreground" };
}

export function DeploymentsMatrix() {
  const artefacts = useOrchestrator((s) => s.snapshot.artefacts);
  const engine = useOrchestrator((s) => s.engine);
  const selectVersion = useOrchestrator((s) => s.selectVersion);
  const selected = useOrchestrator((s) => s.selectedVersion);
  const environments = useOrchestrator((s) => s.snapshot.environments);
  const layers = ENVIRONMENTS.cloud.stack.map((c) => c.layer);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3" data-testid="deployments">
        <section>
          <div className="hud-label mb-2 flex items-center gap-2">
            <Layers className="size-3 text-mjc-cyan" /> Model artefact · mjc/scribe-8b · same digest in every perimeter
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="hud-label [&>th]:pb-1.5 [&>th]:font-normal">
                <th>Version</th>
                {ENV_ORDER.map((e) => (
                  <th key={e}>{ENVIRONMENTS[e].codename}</th>
                ))}
                <th>Parity</th>
              </tr>
            </thead>
            <tbody>
              {artefacts.map((a) => {
                const p = engine.parity(a.version);
                return (
                  <tr
                    key={a.version}
                    onClick={() => selectVersion(a.version)}
                    className={cn("cursor-pointer border-t border-border/40 align-top hover:bg-secondary/40 [&>td]:py-2 [&>td]:pr-2", selected === a.version && "bg-mjc-cyan/5")}
                    data-testid={`artefact-row-${a.version}`}
                  >
                    <td>
                      <div className="font-mono text-[12px] text-foreground">{a.version}</div>
                      <div className="font-mono text-[9px] text-muted-foreground" title={a.manifest.manifest.digest}>
                        sha256 {short(a.manifest.manifest.digest, 6)}
                      </div>
                      <div className="font-mono text-[9px] text-muted-foreground">{a.state}</div>
                    </td>
                    {ENV_ORDER.map((e) => {
                      const c = cellState(a, e);
                      return (
                        <td key={e}>
                          <span className={cn("inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em]", c.tone)}>{c.label}</span>
                          {a.loadedIn[e] && <div className="mt-1 font-mono text-[9px] text-muted-foreground">{short(a.manifest.manifest.digest, 4)}</div>}
                        </td>
                      );
                    })}
                    <td>
                      {p.consistent ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-mjc-green">
                          <BadgeCheck className="size-3.5" /> CONSISTENT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-mjc-amber">
                          <TriangleAlert className="size-3.5" /> MISSING {p.missing.map((m) => m.toUpperCase()).join(",")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Parity compares the SHA-256 of the loaded weights in each environment. Cloud pulls from the registry, on-prem syncs a mirror through the proxy, the enclave only ever receives a signed bundle through the diode.
          </p>
        </section>

        <section>
          <div className="hud-label mb-2">Same model · three stacks</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="[&>th]:pb-2 [&>th]:font-normal">
                  <th className="hud-label">Layer</th>
                  {environments.map((env) => {
                    const Icon = ENV_ICON[env.spec.id];
                    return (
                      <th key={env.spec.id}>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-foreground">
                          <Icon className="size-3.5 text-mjc-cyan" /> {env.spec.codename}
                        </div>
                        <div className="text-[10px] font-normal text-muted-foreground">{env.spec.name}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {layers.map((layer) => (
                  <tr key={layer} className="border-t border-border/40 align-top [&>td]:py-1.5 [&>td]:pr-3">
                    <td className="hud-label whitespace-nowrap pt-2.5">{layer}</td>
                    {environments.map((env) => {
                      const c = env.spec.stack.find((s) => s.layer === layer)!;
                      return (
                        <td key={env.spec.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex cursor-default items-start gap-2">
                                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border border-border/70 bg-secondary/60 text-muted-foreground">
                                  <StackIcon name={c.icon} className="size-3" />
                                </span>
                                <div>
                                  <div className="text-foreground/90">{c.name}</div>
                                  <div className="text-[10px] leading-tight text-muted-foreground">{c.detail}</div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">{c.detail}</TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            {environments.map((env) => (
              <div key={env.spec.id} className="rounded-sm border border-border/60 bg-background/40 p-2">
                <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-foreground">
                  {env.spec.egress ? <Check className="size-3 text-mjc-green" /> : <X className="size-3 text-mjc-red" />} EGRESS
                </div>
                <div className="text-muted-foreground">{env.spec.description}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
