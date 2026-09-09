"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const PATHS = [
  "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
  "M-373 -197C-373 -197 -305 208 159 335C623 462 691 867 691 867",
  "M-366 -205C-366 -205 -298 200 166 327C630 454 698 859 698 859",
  "M-359 -213C-359 -213 -291 192 173 319C637 446 705 851 705 851",
  "M-352 -221C-352 -221 -284 184 180 311C644 438 712 843 712 843",
  "M-345 -229C-345 -229 -277 176 187 303C651 430 719 835 719 835",
  "M-338 -237C-338 -237 -270 168 194 295C658 422 726 827 726 827",
  "M-331 -245C-331 -245 -263 160 201 287C665 414 733 819 733 819",
  "M-324 -253C-324 -253 -256 152 208 279C672 406 740 811 740 811",
  "M-317 -261C-317 -261 -249 144 215 271C679 398 747 803 747 803",
  "M-310 -269C-310 -269 -242 136 222 263C686 390 754 795 754 795",
  "M-303 -277C-303 -277 -235 128 229 255C693 382 761 787 761 787",
];

/** Animated SVG beams (Aceternity "Background Beams" style), deterministic so SSR and client agree. */
export const BackgroundBeams = memo(function BackgroundBeams({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 flex h-full w-full items-center justify-center [mask-image:radial-gradient(ellipse_at_center,white,transparent)]", className)}>
      <svg className="pointer-events-none absolute z-0 h-full w-full" width="100%" height="100%" viewBox="0 0 696 316" fill="none" xmlns="http://www.w3.org/2000/svg">
        {PATHS.map((d, i) => (
          <motion.path key={`p-${i}`} d={d} stroke={`url(#beam-${i})`} strokeOpacity="0.5" strokeWidth="0.6" />
        ))}
        <defs>
          {PATHS.map((_, i) => (
            <motion.linearGradient
              id={`beam-${i}`}
              key={`g-${i}`}
              initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
              animate={{ x1: ["0%", "100%"], x2: ["0%", "95%"], y1: ["0%", "100%"], y2: ["0%", `${93 + (i % 4) * 2}%`] }}
              transition={{ duration: 9 + (i % 5) * 1.3, ease: "easeInOut", repeat: Infinity, delay: (i * 0.9) % 6 }}
            >
              <stop stopColor="#22d3ee" stopOpacity="0" />
              <stop stopColor="#22d3ee" />
              <stop offset="32.5%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </motion.linearGradient>
          ))}
          <radialGradient id="beam-mask" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(352 34) rotate(90) scale(555 1560)">
            <stop offset="0.07" stopColor="#0a0f17" />
            <stop offset="1" stopColor="#05070b" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
});
