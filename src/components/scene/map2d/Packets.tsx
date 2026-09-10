"use client";

import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useOrchestrator, type Packet } from "@/store/orchestrator";
import { CLASS_HEX, MJC } from "@/lib/palette";
import { REFUSED, ROUTE } from "./geometry";
import { MONO } from "./geometry";

const ROUTE_SECONDS = 2.6;
const REFUSE_SECONDS = 1.2;
const BURST_SECONDS = 0.6;
const ROUTE_REMOVE_MS = 3200;
const REFUSE_REMOVE_MS = 2400;

/** A job packet: trunk ++ fan to its perimeter gate, or trunk only and a burst at the barrier. */
export function PacketDot({ packet }: { packet: Packet }) {
  const remove = useOrchestrator((s) => s.removePacket);
  const pts = useMemo(() => (packet.to ? ROUTE[packet.to] : REFUSED), [packet.to]);
  const color = CLASS_HEX[packet.classification];
  const routed = packet.to !== null;

  useEffect(() => {
    const id = setTimeout(() => remove(packet.id), routed ? ROUTE_REMOVE_MS : REFUSE_REMOVE_MS);
    return () => clearTimeout(id);
  }, [packet.id, routed, remove]);

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const travel = routed ? ROUTE_SECONDS : REFUSE_SECONDS;

  return (
    <motion.g initial={{ x: xs[0], y: ys[0], opacity: 0 }} animate={{ x: xs, y: ys, opacity: 1 }} transition={{ x: { duration: travel, ease: "easeInOut" }, y: { duration: travel, ease: "easeInOut" }, opacity: { duration: 0.2 } }} exit={{ opacity: 0 }}>
      <motion.circle
        r={6}
        fill={color}
        style={{ filter: `drop-shadow(0 0 7px ${color})` }}
        initial={{ r: 6, opacity: 1 }}
        animate={routed ? { r: [6, 6, 3.5], opacity: [1, 1, 0.9] } : { r: [6, 6, 14], opacity: [1, 1, 0] }}
        transition={{ duration: travel + (routed ? 0 : BURST_SECONDS), times: routed ? [0, 0.85, 1] : [0, travel / (travel + BURST_SECONDS), 1], ease: "easeInOut" }}
      />
      <motion.text y={-11} textAnchor="middle" fontFamily={MONO} fontSize={7.5} fill={color} letterSpacing={1.5} stroke={MJC.bg} strokeWidth={2.5} paintOrder="stroke" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: travel + (routed ? 0.4 : BURST_SECONDS), times: [0, 0.12, 0.85, 1] }}>
        {`${packet.jobId} · ${packet.classification}`}
      </motion.text>
    </motion.g>
  );
}
