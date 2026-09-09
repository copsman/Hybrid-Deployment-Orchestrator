"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary. If anything in the control room throws, the jury still sees a
 * readable screen with the error and a way back, instead of a blank page.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[MERIDIAN // VANTAGE] control room error", error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center bg-background bg-grid p-6 text-foreground">
      <div className="max-w-xl rounded-md border border-mjc-red/60 bg-card/80 p-6 shadow-[0_0_40px_rgba(244,63,94,0.15)]">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] text-mjc-red">
          <TriangleAlert className="size-4" /> CONTROL ROOM FAULT
        </div>
        <h1 className="mt-3 font-mono text-lg tracking-[0.2em]">MERIDIAN // VANTAGE</h1>
        <p className="mt-2 text-sm text-muted-foreground">The interface hit an unexpected error. The simulation engine and its ledger are unaffected; reload to continue from a fresh seed.</p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-sm border border-border/60 bg-background/60 p-3 font-mono text-[11px] text-foreground/80">{error.message}{error.digest ? `\n\ndigest ${error.digest}` : ""}</pre>
        <button type="button" onClick={reset} className="mt-4 inline-flex items-center gap-2 rounded-sm border border-mjc-cyan/60 bg-mjc-cyan/10 px-3 py-1.5 font-mono text-[11px] tracking-[0.2em] text-mjc-cyan hover:bg-mjc-cyan/20">
          <RotateCcw className="size-3.5" /> RELOAD CONTROL ROOM
        </button>
      </div>
    </main>
  );
}
