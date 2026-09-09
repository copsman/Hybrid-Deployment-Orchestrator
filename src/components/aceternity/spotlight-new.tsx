"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Two soft conic spotlights sweeping across a dark surface (Aceternity "Spotlight New" style). */
export function SpotlightNew({
  className,
  gradientFirst = "radial-gradient(68.5% 68.5% at 55% 31%, rgba(34, 211, 238, 0.10) 0%, rgba(34, 211, 238, 0.03) 50%, rgba(34, 211, 238, 0) 80%)",
  gradientSecond = "radial-gradient(50% 50% at 50% 50%, rgba(34, 211, 238, 0.07) 0%, rgba(34, 211, 238, 0.02) 80%, transparent 100%)",
  gradientThird = "radial-gradient(50% 50% at 50% 50%, rgba(167, 139, 250, 0.05) 0%, rgba(167, 139, 250, 0.02) 80%, transparent 100%)",
  translateY = -350,
  width = 560,
  height = 1380,
  smallWidth = 240,
  duration = 7,
  xOffset = 100,
}: {
  className?: string;
  gradientFirst?: string;
  gradientSecond?: string;
  gradientThird?: string;
  translateY?: number;
  width?: number;
  height?: number;
  smallWidth?: number;
  duration?: number;
  xOffset?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }} className={cn("pointer-events-none absolute inset-0 h-full w-full overflow-hidden", className)}>
      <motion.div animate={{ x: [0, xOffset, 0] }} transition={{ duration, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} className="absolute left-0 top-0 h-screen w-screen pointer-events-none z-0">
        <div style={{ transform: `translateY(${translateY}px) rotate(-45deg)`, background: gradientFirst, width: `${width}px`, height: `${height}px` }} className="absolute left-0 top-0" />
        <div style={{ transform: "rotate(-45deg) translate(5%, -50%)", background: gradientSecond, width: `${smallWidth}px`, height: `${height}px` }} className="absolute left-0 top-0 origin-top-left" />
        <div style={{ transform: "rotate(-45deg) translate(-180%, -70%)", background: gradientThird, width: `${smallWidth}px`, height: `${height}px` }} className="absolute left-0 top-0 origin-top-left" />
      </motion.div>
      <motion.div animate={{ x: [0, -xOffset, 0] }} transition={{ duration, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }} className="absolute right-0 top-0 h-screen w-screen pointer-events-none z-0">
        <div style={{ transform: `translateY(${translateY}px) rotate(45deg)`, background: gradientFirst, width: `${width}px`, height: `${height}px` }} className="absolute right-0 top-0" />
        <div style={{ transform: "rotate(45deg) translate(-5%, -50%)", background: gradientSecond, width: `${smallWidth}px`, height: `${height}px` }} className="absolute right-0 top-0 origin-top-right" />
        <div style={{ transform: "rotate(45deg) translate(180%, -70%)", background: gradientThird, width: `${smallWidth}px`, height: `${height}px` }} className="absolute right-0 top-0 origin-top-right" />
      </motion.div>
    </motion.div>
  );
}
