"use client";

import { useRef } from "react";
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** A light travelling around a rounded rectangle (Aceternity "Moving Border" style). */
export function MovingBorder({ children, duration = 2600, rx = "8px", ry = "8px", className, color = "#22d3ee" }: { children?: React.ReactNode; duration?: number; rx?: string; ry?: string; className?: string; color?: string }) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue<number>(0);
  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) progress.set(((time * length) / duration) % length);
  });
  const x = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).x ?? 0);
  const y = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;
  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%">
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div style={{ position: "absolute", top: 0, left: 0, display: "inline-block", transform }} className={className}>
        {children ?? <div className="size-12 rounded-full opacity-90" style={{ background: `radial-gradient(${color} 30%, transparent 70%)` }} />}
      </motion.div>
    </>
  );
}

export function MovingBorderBadge({ children, className, containerClassName, color = "#22d3ee", duration }: { children: React.ReactNode; className?: string; containerClassName?: string; color?: string; duration?: number }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-transparent p-px", containerClassName)}>
      <div className="absolute inset-0">
        <MovingBorder duration={duration} rx="8px" ry="8px" color={color} />
      </div>
      <div className={cn("relative flex items-center justify-center rounded-[7px] border border-border/70 bg-card/90 backdrop-blur", className)}>{children}</div>
    </div>
  );
}
