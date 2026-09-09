"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play } from "lucide-react";
import { SpotlightNew } from "@/components/aceternity/spotlight-new";
import { BackgroundBeams } from "@/components/aceternity/background-beams";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { MovingBorderBadge } from "@/components/aceternity/moving-border";
import { useDirector } from "@/store/director";

const AUTO_DISMISS_MS = 9000;

/** Cinematic opener. Auto-dismisses, click-through anywhere, skipped with ?intro=0 or reduced motion. */
export function IntroOverlay() {
  const intro = useDirector((s) => s.intro);
  const dismiss = useDirector((s) => s.dismissIntro);
  const play = useDirector((s) => s.play);
  useEffect(() => {
    if (!intro) return;
    const id = setTimeout(dismiss, AUTO_DISMISS_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [intro, dismiss]);

  return (
    <AnimatePresence>
      {intro && (
        <motion.div
          key="intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center overflow-hidden bg-background"
          onClick={dismiss}
          data-testid="intro"
        >
          <div className="absolute inset-0 bg-grid opacity-60" />
          <SpotlightNew />
          <BackgroundBeams />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-scanline bg-gradient-to-r from-transparent via-mjc-cyan/40 to-transparent" />
          <div className="relative z-10 flex max-w-3xl flex-col items-center px-6 text-center">
            <motion.div initial={{ opacity: 0, letterSpacing: "0.8em" }} animate={{ opacity: 1, letterSpacing: "0.45em" }} transition={{ duration: 1.4, ease: "easeOut" }} className="hud-label text-mjc-cyan">
              Meridian Joint Command · Directorate of Digital Assurance
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 14, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 1.1, delay: 0.4 }} className="mt-5 whitespace-nowrap font-mono text-3xl font-semibold tracking-[0.35em] text-foreground text-glow md:text-5xl lg:text-6xl">
              MERIDIAN <span className="text-mjc-cyan">{"//"}</span> VANTAGE
            </motion.h1>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="mt-3 font-mono text-[11px] tracking-[0.35em] text-muted-foreground">
              HYBRID DEPLOYMENT ORCHESTRATOR
            </motion.div>
            <div className="mt-8 max-w-2xl">
              <TextGenerateEffect
                text="One model. Three perimeters. Every decision justified. SCRIBE runs in the cloud, at Fort Meridian and inside Enclave OBSIDIAN — the same signed artefact, routed by policy, logged in a chain nobody can quietly edit."
                className="text-base leading-relaxed text-foreground/85 md:text-lg"
                wordDelay={0.05}
              />
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.2, duration: 0.8 }} className="mt-10 flex items-center gap-4">
              <MovingBorderBadge duration={3200} className="px-5 py-2.5">
                <button
                  type="button"
                  className="flex items-center gap-2 font-mono text-[11px] tracking-[0.3em] text-mjc-cyan"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                    void play();
                  }}
                  data-testid="intro-play"
                >
                  <Play className="size-3.5" /> PLAY THE SCENARIO
                </button>
              </MovingBorderBadge>
              <button type="button" className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground hover:text-foreground" onClick={dismiss}>
                ENTER CONTROL ROOM
              </button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 4.5 }} className="hud-label mt-8">
              click anywhere · esc
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
