"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Circle, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingState {
  text: string;
  detail?: string;
}

/** Stepped checklist overlay (Aceternity "Multi Step Loader" style), driven by an explicit index. */
export function MultiStepLoader({ loadingStates, value, loading, className, cardClassName, done = false, title }: { loadingStates: LoadingState[]; value: number; loading: boolean; className?: string; cardClassName?: string; done?: boolean; title?: string }) {
  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn("absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-md", className)}>
          <div className={cn("relative w-[420px] max-w-[90%] rounded-md border border-border/80 bg-card/90 p-5 shadow-[0_0_60px_rgba(34,211,238,0.12)]", cardClassName)}>
            {title && <div className="hud-label mb-3 text-mjc-cyan">{title}</div>}
            <div className="flex flex-col gap-2">
              {loadingStates.map((s, i) => {
                const distance = Math.abs(i - value);
                const opacity = Math.max(1 - distance * 0.22, 0.25);
                const isDone = i < value || (done && i === value);
                const isCurrent = i === value && !done;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: -(value * 0) }} animate={{ opacity, y: -(value * 0) }} transition={{ duration: 0.4 }} className="flex items-start gap-2">
                    <span className={cn("mt-0.5", isDone ? "text-mjc-green" : isCurrent ? "text-mjc-cyan" : "text-muted-foreground")}>
                      {isDone ? <Check className="size-4" /> : isCurrent ? <Loader className="size-4 animate-spin" /> : <Circle className="size-4" />}
                    </span>
                    <div>
                      <div className={cn("font-mono text-[11px] tracking-[0.14em]", isCurrent ? "text-mjc-cyan" : isDone ? "text-foreground" : "text-muted-foreground")}>{s.text}</div>
                      {s.detail && <div className="text-[11px] text-muted-foreground">{s.detail}</div>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
