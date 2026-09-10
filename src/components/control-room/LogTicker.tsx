"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { useOrchestrator, type LogLevel } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { cn } from "@/lib/utils";

const TONE: Record<LogLevel, string> = {
  info: "text-foreground/80",
  ok: "text-mjc-green",
  warn: "text-mjc-amber",
  error: "text-mjc-red",
  sys: "text-mjc-cyan",
};

export function LogTicker() {
  const log = useOrchestrator((s) => s.log);
  const jury = useDirector((s) => s.jury);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  return (
    <footer className={cn("relative z-20 flex shrink-0 flex-col border-t border-border/80 bg-background/90 backdrop-blur", jury ? "h-[64px]" : "h-[104px]")}>
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1">
        <Terminal className="size-3 text-mjc-cyan" />
        <span className="hud-label">event log · {log.length} lines</span>
        <span className="ml-auto hud-label">hash-chained entries are in the LEDGER tab</span>
      </div>
      <div ref={ref} className="scrollbar-thin flex-1 overflow-y-auto px-3 py-1 font-mono text-[11px] leading-[1.5]" data-testid="event-log">
        {log.map((l) => (
          <div key={l.id} className={cn("flex gap-3 whitespace-pre-wrap", TONE[l.level])}>
            <span className="shrink-0 text-muted-foreground">{l.at.slice(11, 19)}</span>
            <span className="shrink-0 w-10 uppercase text-muted-foreground">{l.level}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
