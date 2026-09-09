"use client";

import { CLASSIFICATION_META, type Classification } from "@/engine";
import { cn } from "@/lib/utils";

const TONE: Record<Classification, string> = {
  OPEN: "border-mjc-cyan/50 bg-mjc-cyan/10 text-mjc-cyan shadow-[0_0_12px_rgba(34,211,238,0.18)]",
  RESTRICTED: "border-mjc-amber/50 bg-mjc-amber/10 text-mjc-amber shadow-[0_0_12px_rgba(245,158,11,0.18)]",
  SECRET: "border-mjc-red/60 bg-mjc-red/10 text-mjc-red shadow-[0_0_12px_rgba(244,63,94,0.2)]",
  ONYX: "border-mjc-violet/60 bg-mjc-violet/10 text-mjc-violet shadow-[0_0_12px_rgba(167,139,250,0.2)]",
};

export function ClassificationBadge({ level, size = "sm", marking = false, className }: { level: Classification; size?: "xs" | "sm" | "md"; marking?: boolean; className?: string }) {
  const meta = CLASSIFICATION_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-mono uppercase tracking-[0.18em]",
        size === "xs" && "px-1.5 py-0 text-[9px]",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-3 py-1 text-xs",
        TONE[level],
        className,
      )}
      title={meta.description}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {marking ? meta.marking : meta.level}
    </span>
  );
}

export const CLASS_HEX: Record<Classification, string> = {
  OPEN: "#22d3ee",
  RESTRICTED: "#f59e0b",
  SECRET: "#f43f5e",
  ONYX: "#a78bfa",
};
