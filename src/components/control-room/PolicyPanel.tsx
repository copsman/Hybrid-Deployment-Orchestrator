"use client";

import { useState } from "react";
import { Braces, ListChecks, ShieldBan } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { POLICY, RULES, ENVIRONMENTS, type PolicyRule } from "@/engine";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { useDirector } from "@/store/director";
import { cn } from "@/lib/utils";

export function PolicyPanel() {
  const [raw, setRaw] = useState(false);
  const jury = useDirector((s) => s.jury);
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="policy-panel">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <ShieldBan className="size-3 text-mjc-cyan" />
        <span className="hud-label">
          {POLICY.policyId} · v{POLICY.version} · default {POLICY.defaultEffect}
        </span>
        {!jury && (
          <button type="button" onClick={() => setRaw(!raw)} className="ml-auto flex items-center gap-1 font-mono text-[9px] tracking-[0.16em] text-muted-foreground hover:text-foreground">
            {raw ? <ListChecks className="size-3" /> : <Braces className="size-3" />} {raw ? "CARDS" : "RAW JSON"}
          </button>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {raw && !jury ? (
          <pre className="p-3 font-mono text-[10px] leading-relaxed text-foreground/85">{JSON.stringify(POLICY, null, 2)}</pre>
        ) : (
          <div className="space-y-2 p-3">
            <p className="text-[11px] text-muted-foreground">
              Authority: {POLICY.authority}. Rules are data, not code: evaluated top to bottom, a job is routable only if a RESTRICT_TO rule grants a set of environments, EXCLUDE rules subtract, any matching REFUSE ends evaluation. Capability checks (CAP-VERSION, CAP-EGRESS, CAP-SLOTS) run afterwards and are traced the same way.
            </p>
            {RULES.map((r) => (
              <RuleCard key={r.id} rule={r} />
            ))}
            <div className="rounded-md border border-border/60 bg-background/40 p-3 text-[11px] text-muted-foreground">
              <div className="hud-label mb-1 text-foreground/80">Capability checks (built in)</div>
              <div><span className="font-mono text-foreground/80">CAP-VERSION</span> · requested model version must be loaded in the environment (shows &quot;pending diode transfer&quot; while in flight).</div>
              <div><span className="font-mono text-foreground/80">CAP-EGRESS</span> · live external retrieval needs an environment with outbound network.</div>
              <div><span className="font-mono text-foreground/80">CAP-SLOTS</span> · fixed-capacity environments queue when full; nothing spills to a less restrictive perimeter.</div>
              <div><span className="font-mono text-foreground/80">SELECT</span> · among what remains: free capacity first, then lowest cost, then most free slots.</div>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function RuleCard({ rule }: { rule: PolicyRule }) {
  const tone = rule.effect === "REFUSE" ? "border-mjc-red/50" : rule.effect === "RESTRICT_TO" ? "border-mjc-cyan/50" : "border-mjc-amber/50";
  const when = rule.when;
  return (
    <div className={cn("rounded-md border bg-secondary/30 p-2.5", tone)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.18em] text-foreground">{rule.id}</span>
        <span className="text-xs text-foreground/90">{rule.title}</span>
        <span className={cn("ml-auto rounded-sm border px-1.5 font-mono text-[9px] tracking-[0.14em]", rule.effect === "REFUSE" ? "border-mjc-red/60 text-mjc-red" : rule.effect === "RESTRICT_TO" ? "border-mjc-cyan/60 text-mjc-cyan" : "border-mjc-amber/60 text-mjc-amber")}>
          {rule.effect}
          {rule.environments ? ` → ${rule.environments.map((e) => ENVIRONMENTS[e].codename).join(", ")}` : ""}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
        <span className="hud-label">when</span>
        {when.classification && (Array.isArray(when.classification) ? when.classification : [when.classification]).map((c) => <ClassificationBadge key={c} level={c} size="xs" />)}
        {when.pii !== undefined && <Chip>pii = {String(when.pii)}</Chip>}
        {when.egress !== undefined && <Chip>egress = {String(when.egress)}</Chip>}
        {when.releasability && <Chip>releasability = {Array.isArray(when.releasability) ? when.releasability.join("|") : when.releasability}</Chip>}
        {when.latency && <Chip>latency = {when.latency}</Chip>}
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{rule.justification}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm border border-border/70 px-1.5 py-0.5 text-muted-foreground">{children}</span>;
}
