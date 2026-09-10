"use client";

import type { ReactNode } from "react";
import { useDirector } from "@/store/director";
import { MJC } from "@/lib/palette";
import { MONO, SANS } from "./geometry";

/** Mono (default) or sans label with the house letter-spacing. */
export function T({
  x,
  y,
  size = 7,
  fill = MJC.mutedFg,
  anchor = "start",
  ls = 1,
  sans = false,
  opacity,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  ls?: number;
  sans?: boolean;
  opacity?: number;
  children: ReactNode;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={sans ? SANS : MONO} fontSize={size} fill={fill} letterSpacing={ls} fillOpacity={opacity}>
      {children}
    </text>
  );
}

/** True when the operator asked for reduced motion: decorative loops stop, state-driven flights stay. */
export function useStill(): boolean {
  return useDirector((s) => s.reducedMotion);
}
