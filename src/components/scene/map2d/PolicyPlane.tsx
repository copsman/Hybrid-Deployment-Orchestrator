"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { POLICY, RULES } from "@/engine";
import { useOrchestrator } from "@/store/orchestrator";
import { MJC } from "@/lib/palette";
import { selDecisions, selLastPacket, selLedgerHead, selLedgerLen, selLedgerOk, selResetSeq } from "../selectors";
import { ARCH, BENCH, HUB, HUB_R, OBELISK, STRIP, VERDICT_Y } from "./geometry";
import { T, useStill } from "./primitives";

/** Delay between a decision and the packet reaching the arch, so the verdict shows as the dot arrives. */
export const REFUSE_MS = 1200;
export const ROUTE_ARCH_MS = 650;
const REFUSE_SHOW_MS = 2200;
const ROUTE_SHOW_MS = 1800;
/** A verdict older than this when the map mounts is not replayed. */
const STALE_MS = 1500;
const MAX_LINKS = 24;

export function Strip() {
  return (
    <g>
      <rect x={STRIP.x} y={STRIP.y} width={STRIP.w} height={STRIP.h} rx={6} fill={MJC.cyan} fillOpacity={0.03} stroke={MJC.cyan} strokeOpacity={0.3} strokeDasharray="6 4" />
      <T x={STRIP.x + 10} y={STRIP.y + 16} size={9} ls={2} fill={MJC.cyan} opacity={0.85}>
        POLICY PLANE · SINGLE ENTRY POINT · DENY BY DEFAULT
      </T>
      <T x={STRIP.x + STRIP.w - 10} y={STRIP.y + 16} size={7} ls={1} anchor="end" fill={MJC.mutedFg}>
        {`POLICY ${POLICY.version} · ${RULES.length} RULES`}
      </T>
    </g>
  );
}

export function Hub({ focused, onSelect }: { focused: boolean; onSelect: () => void }) {
  const decisions = useOrchestrator(selDecisions);
  const still = useStill();
  return (
    <g transform={`translate(${HUB[0]},${HUB[1]})`} onClick={onSelect} className="cursor-pointer">
      <circle r={40} fill="url(#glow-cloud)" />
      <circle r={HUB_R} fill={MJC.card} stroke={MJC.cyan} strokeWidth={focused ? 2 : 1.5} />
      <circle r={HUB_R + 7} fill="none" stroke={MJC.cyan} strokeOpacity={focused ? 0.6 : 0.35} strokeDasharray="3 5">
        {!still && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite" />}
      </circle>
      <T x={0} y={-1} size={8} ls={2} anchor="middle" fill={focused ? MJC.cyan : MJC.fg}>
        ROUTER
      </T>
      <T x={0} y={9} size={5.5} ls={0.5} anchor="middle" fill={MJC.mutedFg}>
        {`${decisions} DECISIONS`}
      </T>
    </g>
  );
}

/** BUILD · SIGN bench on the low side; the artefact token rests above it while BUILT/SIGNED. */
export function Bench() {
  return (
    <g transform={`translate(${BENCH[0]},${BENCH[1]})`}>
      <rect x={-32} y={-11} width={64} height={22} rx={2} fill={MJC.card} stroke={MJC.cyan} strokeOpacity={0.5} />
      <T x={0} y={3} size={7} ls={1} anchor="middle" fill={MJC.fg}>
        BUILD · SIGN
      </T>
      <T x={0} y={22} size={6} ls={1} anchor="middle" fill={MJC.mutedFg}>
        BENCH · LOW SIDE
      </T>
    </g>
  );
}

/** Ledger obelisk: one link per entry (capped), green while the chain verifies, red when broken, a pulse on each append. */
export function Obelisk() {
  const len = useOrchestrator(selLedgerLen);
  const ok = useOrchestrator(selLedgerOk);
  const head = useOrchestrator(selLedgerHead);
  const [pulse, setPulse] = useState<string | null>(null);
  useEffect(
    () =>
      useOrchestrator.subscribe((s, p) => {
        if (s.resetSeq !== p.resetSeq) {
          setPulse(null);
          return;
        }
        const a = selLedgerLen(s);
        if (a > selLedgerLen(p)) setPulse(`pulse-${s.resetSeq}-${a}`);
      }),
    [],
  );
  const tone = ok ? MJC.green : MJC.red;
  const links = Math.min(len, MAX_LINKS);
  const H = 50;
  return (
    <g transform={`translate(${OBELISK[0]},${OBELISK[1]})`}>
      {pulse && <motion.circle key={pulse} r={8} fill="none" stroke={tone} initial={{ r: 8, opacity: 0.7 }} animate={{ r: 30, opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} />}
      <polygon points={`0,${-H / 2} 10,${H / 2} -10,${H / 2}`} fill={MJC.card} stroke={tone} strokeWidth={1.5} strokeOpacity={0.9} />
      {Array.from({ length: links }).map((_, i) => {
        const y = H / 2 - 3 - i * 1.9;
        const half = (10 * (H / 2 - y)) / H - 1;
        return <line key={i} x1={-half} y1={y} x2={half} y2={y} stroke={tone} strokeOpacity={0.7} strokeWidth={0.8} />;
      })}
      <T x={15} y={-2} size={7} ls={1} fill={MJC.fg}>
        {`LEDGER · ${len}`}
      </T>
      <T x={15} y={8} size={6.5} ls={1} fill={tone}>
        {`${ok ? "INTACT" : "BROKEN"} · ${head.slice(0, 8)}`}
      </T>
    </g>
  );
}

interface Verdict {
  key: string;
  seq: number;
  text: string;
  tone: string;
}

/**
 * Policy-barrier arch between the strip and the perimeters: every route passes its field.
 * REFUSED flashes red (delayed to meet the packet, cancelled on reset/null/unmount); a
 * routed packet pulses cyan with `jobId → ENV (· QUEUE #n)`.
 */
export function Barrier() {
  const alert = useOrchestrator((s) => s.alert);
  const last = useOrchestrator(selLastPacket);
  const resetSeq = useOrchestrator(selResetSeq);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  useEffect(() => {
    if (!alert) return;
    const key = `refuse-${alert.at}`;
    const delay = alert.at + REFUSE_MS - Date.now();
    if (delay < -STALE_MS) return;
    const seq = resetSeq;
    const fire = setTimeout(() => {
      setVerdict({ key, seq, text: `REFUSED · ${alert.ruleId ?? "POLICY"}`, tone: MJC.red });
      // The hide timer is deliberately not cleared on cleanup: it only clears its own verdict.
      setTimeout(() => setVerdict((v) => (v?.key === key ? null : v)), REFUSE_SHOW_MS);
    }, Math.max(0, delay));
    return () => clearTimeout(fire);
  }, [alert, resetSeq]);

  useEffect(() => {
    if (!last || last.verdict === "REFUSE" || !last.to) return;
    const key = `route-${last.id}`;
    const delay = last.bornAt + ROUTE_ARCH_MS - Date.now();
    if (delay < -STALE_MS) return;
    const seq = resetSeq;
    const to = last.to.toUpperCase();
    const text = last.verdict === "QUEUE" ? `${last.jobId} → ${to} · QUEUE #${last.position ?? 1}` : `${last.jobId} → ${to}`;
    const fire = setTimeout(() => {
      setVerdict({ key, seq, text, tone: MJC.cyan });
      setTimeout(() => setVerdict((v) => (v?.key === key ? null : v)), ROUTE_SHOW_MS);
    }, Math.max(0, delay));
    return () => clearTimeout(fire);
  }, [last, resetSeq]);

  const shown = verdict && verdict.seq === resetSeq ? verdict : null;
  const refused = shown?.tone === MJC.red;
  const x0 = ARCH.cx - ARCH.halfW;
  const x1 = ARCH.cx + ARCH.halfW;
  return (
    <g>
      <rect x={x0} y={ARCH.top} width={4} height={ARCH.bottom - ARCH.top} fill={MJC.cyan} fillOpacity={0.6} />
      <rect x={x1 - 4} y={ARCH.top} width={4} height={ARCH.bottom - ARCH.top} fill={MJC.cyan} fillOpacity={0.6} />
      <rect x={x0 - 2} y={ARCH.top - 2} width={ARCH.halfW * 2 + 4} height={3} fill={MJC.cyan} fillOpacity={0.7} />
      <motion.rect
        x={x0 + 4}
        y={ARCH.top + 1}
        width={ARCH.halfW * 2 - 8}
        height={ARCH.bottom - ARCH.top - 1}
        fill={shown ? shown.tone : MJC.red}
        animate={{ fillOpacity: shown ? (refused ? 0.7 : 0.35) : 0.12 }}
        transition={{ duration: shown ? 0.12 : 0.6 }}
      />
      <T x={x0 - 6} y={ARCH.bottom - 6} size={5.5} ls={1.2} anchor="end" fill={MJC.mutedFg}>
        POLICY BARRIER
      </T>
      {shown && (
        <motion.g key={shown.key} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: (refused ? REFUSE_SHOW_MS : ROUTE_SHOW_MS) / 1000, times: [0, 0.1, 0.8, 1] }}>
          <rect x={ARCH.cx - 62} y={VERDICT_Y - 7} width={124} height={11} rx={2} fill={MJC.bg} stroke={shown.tone} strokeOpacity={0.5} />
          <T x={ARCH.cx} y={VERDICT_Y + 1} size={7} ls={1} anchor="middle" fill={shown.tone}>
            {shown.text}
          </T>
        </motion.g>
      )}
    </g>
  );
}
