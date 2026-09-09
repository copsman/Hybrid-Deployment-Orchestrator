"use client";

import { AnimatePresence, motion } from "motion/react";
import { useDirector } from "@/store/director";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";

export function Captions() {
  const caption = useDirector((s) => s.caption);
  const title = useDirector((s) => s.title);
  const status = useDirector((s) => s.status);
  const stepIndex = useDirector((s) => s.stepIndex);
  const total = useDirector((s) => s.steps.length);
  const phase = useDirector((s) => (s.stepIndex >= 0 ? s.steps[s.stepIndex]?.phase : null));
  if (!caption || status === "idle") return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${stepIndex}-${title}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="max-w-3xl rounded-md border border-border/70 bg-background/85 px-5 py-3 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
          data-testid="caption"
        >
          <div className="mb-1 flex items-center gap-3">
            <span className="hud-label text-mjc-cyan">{status === "done" ? "END" : `${phase ?? ""} · STEP ${String(stepIndex + 1).padStart(2, "0")}/${total}`}</span>
            <span className="font-mono text-xs tracking-[0.2em] text-foreground">{title?.toUpperCase()}</span>
          </div>
          <TextGenerateEffect key={caption} text={caption} className="text-[15px] leading-snug text-foreground/90" wordDelay={0.025} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
