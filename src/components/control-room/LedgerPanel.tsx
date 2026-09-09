"use client";

import { Hash, ShieldCheck, ShieldAlert, Bug, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrchestrator } from "@/store/orchestrator";
import type { LedgerKind } from "@/engine";
import { cn } from "@/lib/utils";

const KIND_TONE: Partial<Record<LedgerKind, string>> = {
  DECISION: "text-mjc-cyan",
  DISPATCH: "text-foreground/80",
  COMPLETE: "text-mjc-green",
  IMPORT_VERIFIED: "text-mjc-green",
  IMPORT_REJECTED: "text-mjc-red",
  DIODE_TRANSFER: "text-mjc-amber",
  GENESIS: "text-mjc-violet",
};

export function LedgerPanel() {
  const entries = useOrchestrator((s) => s.snapshot.ledger);
  const status = useOrchestrator((s) => s.ledgerStatus);
  const tampered = useOrchestrator((s) => s.ledgerTampered);
  const { verifyLedger, tamperLedger, restoreLedger } = useOrchestrator.getState();

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="ledger-panel">
      <div className={cn("m-3 rounded-md border p-3", status.ok ? "border-mjc-green/50 bg-mjc-green/5" : "border-mjc-red/60 bg-mjc-red/5 animate-alert")}>
        <div className="flex items-center gap-2">
          {status.ok ? <ShieldCheck className="size-4 text-mjc-green" /> : <ShieldAlert className="size-4 text-mjc-red" />}
          <span className={cn("font-mono text-[11px] tracking-[0.2em]", status.ok ? "text-mjc-green" : "text-mjc-red")} data-testid="ledger-status">
            {status.ok ? "CHAIN INTACT" : "CHAIN BROKEN"}
          </span>
          <span className="text-xs text-muted-foreground">· {status.detail}</span>
        </div>
        <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">head {status.head}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px] tracking-[0.16em]" onClick={verifyLedger} data-testid="ledger-verify">
            <Hash className="size-3" /> VERIFY CHAIN
          </Button>
          {!tampered ? (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 border-mjc-red/50 font-mono text-[10px] tracking-[0.16em] text-mjc-red hover:bg-mjc-red/10" onClick={tamperLedger} data-testid="ledger-tamper">
              <Bug className="size-3" /> TAMPER A DECISION
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 font-mono text-[10px] tracking-[0.16em]" onClick={restoreLedger} data-testid="ledger-restore">
              <RotateCcw className="size-3" /> RESTORE
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          hash<sub>n</sub> = SHA-256( hash<sub>n-1</sub> ‖ canonical-json(entry<sub>n</sub>) ). Editing any historical entry changes its hash and breaks every link after it, so an auditor can prove the routing history was never rewritten.
        </p>
      </div>
      <div className="hud-label border-y border-border/60 px-3 py-1.5">{entries.length} entries · newest first</div>
      <ScrollArea className="min-h-0 flex-1">
        <ol className="divide-y divide-border/40 font-mono text-[10px]">
          {entries
            .slice()
            .reverse()
            .map((e) => (
              <li key={e.seq} className={cn("grid grid-cols-[34px_120px_1fr] gap-2 px-3 py-1.5", !status.ok && status.brokenAt !== null && e.seq >= status.brokenAt && "bg-mjc-red/5")}>
                <span className="text-muted-foreground">#{String(e.seq).padStart(3, "0")}</span>
                <span className={cn("truncate tracking-[0.1em]", KIND_TONE[e.kind] ?? "text-foreground/70")}>{e.kind}</span>
                <span className="min-w-0">
                  <span className="text-foreground/90">{e.subject}</span>
                  <span className="ml-2 text-muted-foreground">{e.hash.slice(0, 20)}…</span>
                  <span className="ml-2 text-muted-foreground/70">{e.at.slice(11, 19)}</span>
                </span>
              </li>
            ))}
        </ol>
      </ScrollArea>
    </div>
  );
}
