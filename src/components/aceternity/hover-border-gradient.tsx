"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

/** Rotating gradient border that fills on hover (Aceternity "Hover Border Gradient" style). */
export function HoverBorderGradient({ children, containerClassName, className, duration = 1, clockwise = true, color = "#22d3ee", ...props }: React.PropsWithChildren<{ containerClassName?: string; className?: string; duration?: number; clockwise?: boolean; color?: string }> & React.HTMLAttributes<HTMLDivElement>) {
  const [hovered, setHovered] = useState(false);
  const [direction, setDirection] = useState<Direction>("TOP");
  const rotate = (d: Direction): Direction => {
    const dirs: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const i = dirs.indexOf(d);
    return clockwise ? dirs[(i - 1 + dirs.length) % dirs.length] : dirs[(i + 1) % dirs.length];
  };
  const map: Record<Direction, string> = {
    TOP: `radial-gradient(20.7% 50% at 50% 0%, ${color} 0%, rgba(255, 255, 255, 0) 100%)`,
    LEFT: `radial-gradient(16.6% 43.1% at 0% 50%, ${color} 0%, rgba(255, 255, 255, 0) 100%)`,
    BOTTOM: `radial-gradient(20.7% 50% at 50% 100%, ${color} 0%, rgba(255, 255, 255, 0) 100%)`,
    RIGHT: `radial-gradient(16.2% 41.2% at 100% 50%, ${color} 0%, rgba(255, 255, 255, 0) 100%)`,
  };
  const highlight = `radial-gradient(75% 181% at 50% 50%, ${color} 0%, rgba(255, 255, 255, 0) 100%)`;
  useEffect(() => {
    if (hovered) return;
    const id = setInterval(() => setDirection((d) => rotate(d)), duration * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, duration]);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className={cn("relative flex h-min w-fit items-center justify-center overflow-visible rounded-md border border-border/60 bg-card/40 p-px transition duration-500", containerClassName)} {...props}>
      <div className={cn("z-10 w-auto rounded-[inherit] bg-card px-4 py-2 text-foreground", className)}>{children}</div>
      <motion.div className="absolute inset-0 z-0 flex-none overflow-hidden rounded-[inherit]" style={{ filter: "blur(2px)", position: "absolute", width: "100%", height: "100%" }} initial={{ background: map[direction] }} animate={{ background: hovered ? [map[direction], highlight] : map[direction] }} transition={{ ease: "linear", duration: duration ?? 1 }} />
      <div className="absolute inset-[2px] z-[1] flex-none rounded-[inherit] bg-card" />
    </div>
  );
}
