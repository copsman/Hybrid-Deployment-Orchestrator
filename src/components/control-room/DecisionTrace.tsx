"use client";

import { Check, X, Hash, Minus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { useOrchestrator } from "@/store/orchestrator";
import type { Decision, RuleTrace } from "@/engine";
import { cn } from "@/lib/utils";

export function DecisionTrace() {
  const decisions = useOrchestrator((s) => s.snapshot.decisions);
  const selectedId = useOrchestrator((s) => s.selectedDecisionId);
  const select = useOrchestrator((s) => s.selectDecision);
  const decision = decisions.find((d) => d.id === selectedId) ?? decisions[decisions.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <span className="hud-label">Decision record</span>
        <div className="ml-auto flex max-w-[60%] gap-1 overflow-x-auto scrollbar-thin">
          {decisions
            .slice()
            .reverse()
            .map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => select(d.id)}
                className={cn(
                  "shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em]",
                  decision?.id === d.id ? "border-mjc-cyan/60 text-mjc-cyan" : "border-border/60 text-muted-foreground hover:text-foreground",
                  d.verdict.kind === "REFUSE" && decision?.id !== d.id && "border-mjc-red/40",
                )}
              >
                {d.jobId}
              </button>
            ))}
        </div>
      </div>
      {!decision ? (
        <div className="p-6 text-center text-xs text-muted-foreground">No decisions yet. Every submission, allowed or refused, produces a full record here.</div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <DecisionBody decision={decision} />
        </ScrollArea>
      )}
    </div>
  );
}

export function DecisionBody({ decision: d }: { decision: Decision }) {
  const v = d.verdict;
  const tone = v.kind === "REFUSE" ? "red" : v.kind === "QUEUE" ? "amber" : "green";
  return (
    <div className="space-y-3 p-3" data-testid="decision-body" data-verdict={v.kind}>
      <div
        className={cn(
          "rounded-md border p-3",
          tone === "red" && "border-mjc-red/60 bg-mjc-red/5",
          tone === "amber" && "border-mjc-amber/60 bg-mjc-amber/5",
          tone === "green" && "border-mjc-green/60 bg-mjc-green/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.2em] text-foreground">{d.jobId}</span>
          <ClassificationBadge level={d.input.classification} size="xs" marking />
          <span className="font-mono text-[10px] text-muted-foreground">{d.id}</span>
          <span className={cn("ml-auto font-mono text-[11px] tracking-[0.2em]", tone === "red" ? "text-mjc-red" : tone === "amber" ? "text-mjc-amber" : "text-mjc-green")}>
            {v.kind === "REFUSE" ? `REFUSED · ${v.ruleId}` : v.kind === "QUEUE" ? `QUEUED · ${v.env.toUpperCase()} #${v.position}` : `ROUTE → ${v.env.toUpperCase()}`}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-foreground/90">{d.justification}</p>
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{d.input.title}</span>
          {d.input.summary ? ` — ${d.input.summary}` : ""}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px]">
          <Chip>{d.input.releasability}</Chip>
          <Chip>model {d.input.modelVersion}</Chip>
          <Chip>{d.input.latency}</Chip>
          {d.input.pii && <Chip tone="amber">personal data</Chip>}
          {d.input.egress && <Chip tone="cyan">live external retrieval</Chip>}
        </div>
      </div>

      <div>
        <div className="hud-label mb-1.5">Rule trace · evaluated top to bottom · default DENY</div>
        <ol className="space-y-1">
          {d.trace.map((t) => (
            <TraceRow key={t.ruleId} t={t} />
          ))}
        </ol>
      </div>

      <div>
        <div className="hud-label mb-1.5">Candidates</div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="hud-label [&>th]:py-1 [&>th]:font-normal">
              <th>Env</th>
              <th>Allowed</th>
              <th>Cost</th>
              <th>Free</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {d.candidates.map((c) => (
              <tr key={c.env} className="border-t border-border/40 align-top [&>td]:py-1.5 [&>td]:pr-2">
                <td className="font-mono text-[10px] tracking-[0.16em]">{c.env.toUpperCase()}</td>
                <td>{c.allowed ? <Check className="size-3.5 text-mjc-green" /> : <X className="size-3.5 text-mjc-red" />}</td>
                <td className="font-mono text-[11px]">{c.cost}</td>
                <td className="font-mono text-[11px]">{c.freeSlots === null ? "∞" : c.freeSlots}</td>
                <td className="text-[11px] text-muted-foreground">{c.reasons.length ? c.reasons.join(" · ") : c.allowed ? "permitted, version present" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 rounded-sm border border-border/60 bg-background/50 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        <Hash className="size-3 text-mjc-cyan" />
        <span>ledger</span>
        <span className="truncate text-foreground/80">{d.ledgerHash || "(dry run, not recorded)"}</span>
      </div>
    </div>
  );
}

function TraceRow({ t }: { t: RuleTrace }) {
  const effectTone =
    t.effect === "REFUSE" ? "text-mjc-red border-mjc-red/50" : t.effect === "RESTRICT_TO" ? "text-mjc-cyan border-mjc-cyan/50" : t.effect === "EXCLUDE" ? "text-mjc-amber border-mjc-amber/50" : "text-muted-foreground border-border/60";
  return (
    <li className={cn("flex items-start gap-2 rounded-sm border px-2 py-1.5", t.matched ? "border-border/80 bg-secondary/40" : "border-border/30 opacity-60")}>
      <span className="mt-0.5">{t.matched ? <Check className="size-3.5 text-mjc-green" /> : <Minus className="size-3.5 text-muted-foreground" />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.16em] text-foreground">{t.ruleId}</span>
          <span className="text-xs text-foreground/90">{t.title}</span>
          <span className={cn("ml-auto rounded-sm border px-1.5 font-mono text-[9px] tracking-[0.14em]", effectTone)}>
            {t.effect}
            {t.environments && t.environments.length ? ` ${t.environments.join(",")}` : ""}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">{t.note}</div>
      </div>
    </li>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "amber" | "cyan" }) {
  return (
    <span className={cn("rounded-sm border px-1.5 py-0.5", tone === "amber" ? "border-mjc-amber/50 text-mjc-amber" : tone === "cyan" ? "border-mjc-cyan/50 text-mjc-cyan" : "border-border/70 text-muted-foreground")}>
      {children}
    </span>
  );
}
