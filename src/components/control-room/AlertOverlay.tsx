"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShieldBan } from "lucide-react";
import { useOrchestrator } from "@/store/orchestrator";

export function AlertOverlay() {
  const alert = useOrchestrator((s) => s.alert);
  const clear = useOrchestrator((s) => s.clearAlert);
  useEffect(() => {
    if (!alert) return;
    const id = setTimeout(clear, 3200);
    return () => clearTimeout(id);
  }, [alert, clear]);
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.at}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2"
          data-testid="refusal-alert"
        >
          <div className="flex items-center gap-2 rounded-sm border border-mjc-red/70 bg-mjc-red/10 px-3 py-1.5 font-mono text-[11px] tracking-[0.2em] text-mjc-red backdrop-blur animate-alert">
            <ShieldBan className="size-3.5" /> REQUEST REFUSED · {alert.text.toUpperCase()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
