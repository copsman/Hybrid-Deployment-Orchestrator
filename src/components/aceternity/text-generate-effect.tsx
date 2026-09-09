"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Word-by-word reveal in the style of Aceternity's TextGenerateEffect. */
export function TextGenerateEffect({ text, className, wordDelay = 0.06, filter = true }: { text: string; className?: string; wordDelay?: number; filter?: boolean }) {
  const words = text.split(" ");
  return (
    <div className={cn("font-sans", className)}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ opacity: 0, filter: filter ? "blur(6px)" : "none" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.4, delay: i * wordDelay, ease: "easeOut" }}
          className="inline-block"
        >
          {w}&nbsp;
        </motion.span>
      ))}
    </div>
  );
}
