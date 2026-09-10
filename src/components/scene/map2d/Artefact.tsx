"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import type { ArtefactState } from "@/engine";
import { useOrchestrator } from "@/store/orchestrator";
import { MJC } from "@/lib/palette";
import { parseImportKey, selImportKey, selResetSeq } from "../selectors";
import { BENCH_REST, OUTBOX, QUARANTINE, boxCentre, registryRest, type P } from "./geometry";
import { MONO } from "./geometry";

interface Label {
  dx: number;
  dy: number;
  anchor: "start" | "middle" | "end";
}

interface Stop {
  p: P;
  /** opacity keyframes: hidden, shown, or shown-then-faded (LOADED) */
  opacity: number | number[];
  label: Label | null;
}

const LEFT: Label = { dx: -10, dy: 3, anchor: "end" };
const BELOW: Label = { dx: 0, dy: 12, anchor: "middle" };
const ABOVE: Label = { dx: 0, dy: -20, anchor: "middle" };
const FADE_SECONDS = 2.4;

function restStop(state: ArtefactState | null): Stop | null {
  switch (state) {
    case "BUILT":
    case "SIGNED":
      return { p: BENCH_REST, opacity: 1, label: LEFT };
    case "PUBLISHED":
      return { p: registryRest("cloud"), opacity: 1, label: BELOW };
    case "MIRRORED":
      return { p: registryRest("onprem"), opacity: 1, label: BELOW };
    case "STAGED":
      // parked on the outbox lip; the tray itself names the stop and shows the chunk count
      return { p: [boxCentre(OUTBOX)[0], OUTBOX.y + OUTBOX.h - 5], opacity: 1, label: null };
    case "IN_DIODE":
    case "QUARANTINE":
    case "VERIFYING":
      return { p: boxCentre(QUARANTINE), opacity: 0, label: null };
    case "IMPORTED":
      return { p: registryRest("airgapped"), opacity: 1, label: BELOW };
    case "LOADED":
      // the verify step imports and loads in one refresh: show the arrival, then fade
      return { p: registryRest("airgapped"), opacity: [1, 1, 0], label: BELOW };
    case "REJECTED":
      return { p: boxCentre(QUARANTINE), opacity: 1, label: ABOVE };
    default:
      return null;
  }
}

/**
 * The signed bundle as one token that rests where the newest artefact is: bench → cloud
 * registry → on-prem registry → outbox → (chunks) → enclave registry. A change of state
 * animates it between stops; a change of version or a reset remounts it without a flight
 * (`initial={false}` lands on the final keyframe, so a LOADED baseline stays hidden).
 */
export function ArtefactToken() {
  const importKey = useOrchestrator(selImportKey);
  const resetSeq = useOrchestrator(selResetSeq);
  const info = useMemo(() => parseImportKey(importKey), [importKey]);
  const stop = restStop(info.state);
  if (!stop) return null;
  const rejected = info.state === "REJECTED";
  const tone = rejected ? MJC.red : MJC.amber;
  const word = rejected ? "REJECTED" : info.state === "BUILT" ? "BUILT" : "SIGNED";
  const fading = Array.isArray(stop.opacity);
  return (
    <motion.g
      key={`token-${resetSeq}-${info.version}`}
      initial={false}
      animate={{ x: stop.p[0], y: stop.p[1], opacity: stop.opacity }}
      transition={{
        x: { duration: 1.2, ease: "easeInOut" },
        y: { duration: 1.2, ease: "easeInOut" },
        opacity: fading ? { duration: FADE_SECONDS, times: [0, 0.7, 1], ease: "easeInOut" } : { duration: 0.4, delay: stop.opacity ? 0 : 0.6 },
      }}
      style={{ pointerEvents: "none" }}
    >
      <rect x={-6} y={-4.5} width={12} height={9} rx={1.5} fill={tone} stroke={MJC.bg} strokeWidth={0.8} />
      <rect x={-3} y={-1.5} width={6} height={3} rx={0.5} fill={MJC.bg} fillOpacity={0.6} />
      {stop.label && (
        <text x={stop.label.dx} y={stop.label.dy} textAnchor={stop.label.anchor} fontFamily={MONO} fontSize={6.5} fill={tone} letterSpacing={1} stroke={MJC.bg} strokeWidth={2.5} paintOrder="stroke">
          {`SCRIBE ${info.version} · ${word}`}
        </text>
      )}
    </motion.g>
  );
}
