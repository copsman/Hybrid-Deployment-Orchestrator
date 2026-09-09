"use client";

import { motion, useSpring, useTransform, useMotionValue } from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Progress-driven variant of Aceternity's TracingBeam. Instead of scroll position the beam
 * follows a 0..1 value (the artefact pipeline / diode transfer), so the director can drive it.
 */
export function TracingBeam({ progress, children, className }: { progress: number; children: React.ReactNode; className?: string }) {
  const raw = useMotionValue(progress);
  useEffect(() => {
    raw.set(Math.max(0, Math.min(1, progress)));
  }, [progress, raw]);
  const smooth = useSpring(raw, { stiffness: 120, damping: 24, mass: 0.6 });
  const height = useTransform(smooth, (v) => `${v * 100}%`);
  const glowTop = useTransform(smooth, (v) => `calc(${v * 100}% - 6px)`);
  return (
    <div className={cn("relative pl-6", className)}>
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border/70" />
      <motion.div style={{ height }} className="absolute left-[6px] top-1 w-[3px] rounded-full bg-gradient-to-b from-mjc-cyan via-mjc-cyan to-mjc-green shadow-[0_0_12px_var(--mjc-cyan)]" />
      <motion.div style={{ top: glowTop }} className="absolute left-[2px] size-3 rounded-full border border-mjc-cyan bg-background shadow-[0_0_16px_var(--mjc-cyan)]" />
      {children}
    </div>
  );
}
