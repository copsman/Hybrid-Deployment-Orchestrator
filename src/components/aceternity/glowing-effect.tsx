"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { animate } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Pointer-following conic glow on a card border (Aceternity "Glowing Effect" style).
 * Place inside a `relative` container; it renders behind the content.
 */
export const GlowingEffect = memo(function GlowingEffect({ blur = 0, inactiveZone = 0.7, proximity = 64, spread = 24, variant = "default", glow = false, className, movementDuration = 1.6, borderWidth = 1, disabled = false }: { blur?: number; inactiveZone?: number; proximity?: number; spread?: number; variant?: "default" | "white"; glow?: boolean; className?: string; movementDuration?: number; borderWidth?: number; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  const handleMove = useCallback(
    (e?: MouseEvent | { x: number; y: number }) => {
      if (!ref.current) return;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const { left, top, width, height } = el.getBoundingClientRect();
        const mx = e?.x ?? lastPos.current.x;
        const my = e?.y ?? lastPos.current.y;
        if (e) lastPos.current = { x: mx, y: my };
        const cx = left + width / 2;
        const cy = top + height / 2;
        const dist = Math.hypot(mx - cx, my - cy);
        const inactive = 0.5 * Math.min(width, height) * inactiveZone;
        if (dist < inactive) {
          el.style.setProperty("--active", "0");
          return;
        }
        const active = mx > left - proximity && mx < left + width + proximity && my > top - proximity && my < top + height + proximity;
        el.style.setProperty("--active", active ? "1" : "0");
        if (!active) return;
        const current = parseFloat(el.style.getPropertyValue("--start")) || 0;
        const target = (180 * Math.atan2(my - cy, mx - cx)) / Math.PI + 90;
        const diff = ((target - current + 180) % 360) - 180;
        animate(current, current + diff, { duration: movementDuration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => el.style.setProperty("--start", String(v)) });
      });
    },
    [inactiveZone, proximity, movementDuration],
  );

  useEffect(() => {
    if (disabled) return;
    const onScroll = () => handleMove();
    const onMove = (e: PointerEvent) => handleMove(e);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.body.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
      document.body.removeEventListener("pointermove", onMove);
    };
  }, [handleMove, disabled]);

  return (
    <>
      <div className={cn("pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity", glow && "opacity-100", variant === "white" && "border-white", disabled && "!block")} />
      <div
        ref={ref}
        style={
          {
            "--blur": `${blur}px`,
            "--spread": spread,
            "--start": "0",
            "--active": "0",
            "--glowingeffect-border-width": `${borderWidth}px`,
            "--repeating-conic-gradient-times": "5",
            "--gradient": variant === "white" ? "repeating-conic-gradient(from 236.84deg at 50% 50%, #fff, #fff calc(25% / var(--repeating-conic-gradient-times)))" : "radial-gradient(circle, #22d3ee 10%, #22d3ee00 20%), radial-gradient(circle at 40% 40%, #a78bfa 5%, #a78bfa00 15%), radial-gradient(circle at 60% 60%, #34d399 10%, #34d39900 20%), radial-gradient(circle at 40% 60%, #f59e0b 10%, #f59e0b00 20%), repeating-conic-gradient(from 236.84deg at 50% 50%, #22d3ee 0%, #a78bfa calc(25% / var(--repeating-conic-gradient-times)), #34d399 calc(50% / var(--repeating-conic-gradient-times)), #f59e0b calc(75% / var(--repeating-conic-gradient-times)), #22d3ee calc(100% / var(--repeating-conic-gradient-times)))",
          } as React.CSSProperties
        }
        className={cn("pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity", glow && "opacity-100", blur > 0 && "blur-[var(--blur)]", className, disabled && "!hidden")}
      >
        <div
          className={cn(
            "glow rounded-[inherit]",
            "after:content-[''] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]",
            "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
            "after:[background:var(--gradient)] after:[background-attachment:fixed]",
            "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
            "after:[mask-clip:padding-box,border-box]",
            "after:[mask-composite:intersect]",
            "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
          )}
        />
      </div>
    </>
  );
});
