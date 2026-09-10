"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useOrchestrator, type OrchestratorState } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { MJC } from "@/lib/palette";
import { parseImportKey, selImportKey, selPlaying, selResetSeq, selStepId } from "../selectors";
import { CONSOLES, DIODE_TEXT, GATE, OUTBOX, QUARANTINE, TICKS, boxCentre, type Box } from "./geometry";
import { T, useStill } from "./primitives";

interface Flight {
  key: string;
  k: number;
}

const MAX_FLIGHTS = 6;
const FLIGHT_SECONDS = 0.45;
const MANUAL_SCAN_MS = 1500;
const DEFAULT_TOTAL = 32;

/**
 * Chunk count of a bundle staged in the outbox before the first diode.progress event
 * (the `diode` signal only exists once a chunk has crossed). Local to the map; a primitive.
 */
const selStagedTotal = (s: OrchestratorState): number => {
  const list = s.snapshot.artefacts;
  const a = list[list.length - 1];
  return a && a.state === "STAGED" && a.transfer ? a.transfer.totalChunks : 0;
};

/**
 * The diode gate, its real `sent/total` counter and 32-tick bar, the low-side outbox and
 * high-side quarantine trays, chunk flights keyed on `sent` changes, the bounce keyed on
 * `bounces`, the quarantine scanner and the two operator consoles of the import ceremony.
 * The wall itself is drawn by the map before the routes so the gate sits over them.
 */
export function Diode({ focused, onSelect }: { focused: boolean; onSelect: () => void }) {
  const diode = useOrchestrator((s) => s.diode);
  const stagedTotal = useOrchestrator(selStagedTotal);
  const resetSeq = useOrchestrator(selResetSeq);
  const importKey = useOrchestrator(selImportKey);
  const stepId = useDirector(selStepId);
  const playing = useDirector(selPlaying);
  const still = useStill();
  const info = useMemo(() => parseImportKey(importKey), [importKey]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [manualScan, setManualScan] = useState(false);

  // Flights and the manual-scan sweep are derived from store transitions, never from render.
  useEffect(() => {
    let scanTimer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useOrchestrator.subscribe((s, p) => {
      if (s.resetSeq !== p.resetSeq) {
        setFlights([]);
        setManualScan(false);
        if (scanTimer) clearTimeout(scanTimer);
        return;
      }
      if (s.diode !== p.diode) {
        const next = s.diode;
        const prev = p.diode;
        if (!next || !prev || next.version !== prev.version) setFlights([]);
        if (next && prev && next.version === prev.version && next.sent > prev.sent) {
          const n = Math.min(2, next.sent - prev.sent);
          const fresh: Flight[] = [];
          for (let k = 0; k < n; k++) fresh.push({ key: `chunk-${s.resetSeq}-${next.version}-${next.sent}-${k}`, k });
          setFlights((f) => [...f.slice(-(MAX_FLIGHTS - n)), ...fresh]);
        }
      }
      const a = selImportKey(s);
      const b = selImportKey(p);
      if (a !== b) {
        const ia = parseImportKey(a);
        const ib = parseImportKey(b);
        if (ia.scanned && !ib.scanned && ia.version === ib.version) {
          setManualScan(true);
          if (scanTimer) clearTimeout(scanTimer);
          scanTimer = setTimeout(() => setManualScan(false), MANUAL_SCAN_MS);
        }
      }
    });
    return () => {
      unsub();
      if (scanTimer) clearTimeout(scanTimer);
    };
  }, []);

  const active = diode?.active ?? false;
  const sent = diode?.sent ?? 0;
  const total = diode?.total ?? (stagedTotal || DEFAULT_TOTAL);
  const bounces = diode?.bounces ?? 0;
  const imported = diode !== null && info.version === diode.version && (info.state === "IMPORTED" || info.state === "LOADED");
  const outboxCount = diode ? total - sent : stagedTotal;
  const quarantineCount = diode && !imported ? sent : 0;
  const scanning = (playing && stepId === "scan") || manualScan;
  const ceremony = info.state === "QUARANTINE" || info.state === "VERIFYING";
  const status = !diode
    ? "NO RETURN CHANNEL"
    : active
      ? bounces > 0
        ? `${bounces} RETURN ${bounces === 1 ? "ATTEMPT" : "ATTEMPTS"} BLOCKED`
        : "TRANSFER · ONE-WAY"
      : bounces > 0
        ? `COMPLETE · ${bounces} BLOCKED`
        : `COMPLETE · ${total} CHUNKS`;
  const ticks = Math.min(total, DEFAULT_TOTAL);

  return (
    <g>
      {/* text stack above the gate */}
      <T x={GATE[0]} y={DIODE_TEXT.status} size={6} ls={0.5} anchor="middle" fill={bounces > 0 && active ? MJC.red : MJC.mutedFg}>
        {status}
      </T>
      <T x={GATE[0]} y={DIODE_TEXT.title} size={9} ls={2} anchor="middle" fill={focused || active ? MJC.cyan : MJC.fg}>
        DIODE
      </T>
      <rect x={GATE[0] - 19} y={DIODE_TEXT.counterTop} width={38} height={12} rx={2} fill={MJC.bg} />
      <T x={GATE[0]} y={DIODE_TEXT.counter} size={8} ls={0.5} anchor="middle" fill={diode ? MJC.cyan : MJC.mutedFg}>
        {`${sent}/${total}`}
      </T>

      {/* gate glyph: the only way through the wall */}
      <g transform={`translate(${GATE[0]},${GATE[1]})`} onClick={onSelect} className="cursor-pointer">
        <polygon points="-16,-14 14,0 -16,14" fill={MJC.bg} stroke={MJC.cyan} strokeWidth={focused || active ? 2 : 1.5} strokeOpacity={focused || active ? 1 : 0.75}>
          {active && !still && <animate attributeName="stroke-opacity" values="1;0.45;1" dur="0.9s" repeatCount="indefinite" />}
        </polygon>
        <polygon points="-8,-6 4,0 -8,6" fill={MJC.cyan} fillOpacity={active ? 0.9 : 0.35} />
      </g>

      {/* trays */}
      <Tray box={OUTBOX} label="OUTBOX" count={outboxCount} tone={MJC.amber} lit={outboxCount > 0} />
      <Tray box={QUARANTINE} label="QUARANTINE" count={quarantineCount} tone={MJC.red} lit={quarantineCount > 0} />
      {scanning && (
        <g>
          <rect x={QUARANTINE.x} y={QUARANTINE.y} width={QUARANTINE.w} height={QUARANTINE.h} fill={MJC.cyan} fillOpacity={0.15} />
          <rect x={QUARANTINE.x + 2} y={QUARANTINE.y + 2} width={1.5} height={QUARANTINE.h - 4} fill={MJC.cyan}>
            {!still && <animate attributeName="x" values={`${QUARANTINE.x + 2};${QUARANTINE.x + QUARANTINE.w - 4};${QUARANTINE.x + 2}`} dur="1.2s" repeatCount="indefinite" />}
          </rect>
        </g>
      )}

      {/* 32-tick progress bar across the wall */}
      {Array.from({ length: ticks }).map((_, i) => (
        <rect key={i} x={TICKS.x + i * TICKS.pitch} y={TICKS.y} width={TICKS.w} height={TICKS.h} fill={i < sent ? MJC.amber : MJC.secondary} stroke={MJC.amber} strokeOpacity={i < sent ? 0 : 0.25} strokeWidth={0.4} />
      ))}

      {/* chunk flights: one pair per `sent` change, never a loop */}
      {flights.map((f) => (
        <motion.rect
          key={f.key}
          width={10}
          height={5}
          rx={1}
          fill={MJC.amber}
          initial={{ x: boxCentre(OUTBOX)[0] - 5, y: boxCentre(OUTBOX)[1] - 2.5, opacity: 0.4 }}
          animate={{ x: [boxCentre(OUTBOX)[0] - 5, GATE[0] - 5, boxCentre(QUARANTINE)[0] - 5], y: [boxCentre(OUTBOX)[1] - 2.5, GATE[1] - 2.5, boxCentre(QUARANTINE)[1] - 2.5], opacity: [1, 1, 0.8] }}
          transition={{ duration: FLIGHT_SECONDS, delay: f.k * 0.08, ease: "easeInOut" }}
          onAnimationComplete={() => setFlights((list) => list.filter((x) => x.key !== f.key))}
        />
      ))}

      {/* the return-path attempt from the high side, keyed on the bounce count */}
      {diode && active && bounces > 0 && (
        <motion.circle
          key={`bounce-${resetSeq}-${diode.version}-${bounces}`}
          r={4}
          fill={MJC.red}
          style={{ filter: `drop-shadow(0 0 5px ${MJC.red})` }}
          initial={{ cx: boxCentre(QUARANTINE)[0], cy: GATE[1], opacity: 1 }}
          animate={{ cx: [boxCentre(QUARANTINE)[0], GATE[0] + 10, GATE[0] + 30], cy: [GATE[1], GATE[1], GATE[1] + 20], opacity: [1, 1, 0] }}
          transition={{ duration: 1.3, ease: "easeOut" }}
        />
      )}

      {/* operator consoles of the two-person import ceremony */}
      {CONSOLES.map(([x, y], k) => {
        const approved = info.approvals > k && (ceremony || info.state === "IMPORTED" || info.state === "LOADED");
        const state = approved ? "APPROVED" : ceremony ? "AWAITING" : "STANDBY";
        return <Console key={k} x={x} y={y} operator={info.operators[k] ?? `OPERATOR ${k + 1}`} state={state} />;
      })}
    </g>
  );
}

function Tray({ box, label, count, tone, lit }: { box: Box; label: string; count: number; tone: string; lit: boolean }) {
  const [cx] = boxCentre(box);
  return (
    <g>
      <T x={cx} y={box.y - 5} size={5.5} ls={0.8} anchor="middle" fill={tone} opacity={0.9}>
        {label}
      </T>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={2} fill={MJC.card} stroke={tone} strokeOpacity={lit ? 0.9 : 0.4} strokeWidth={lit ? 1.2 : 0.8} />
      {lit && <rect x={box.x + 3} y={box.y + box.h - 7} width={box.w - 6} height={4} rx={1} fill={tone} fillOpacity={0.55} />}
      <T x={cx} y={box.y + 9.5} size={8} ls={0.5} anchor="middle" fill={lit ? tone : MJC.mutedFg}>
        {count}
      </T>
    </g>
  );
}

function Console({ x, y, operator, state }: { x: number; y: number; operator: string; state: "APPROVED" | "AWAITING" | "STANDBY" }) {
  const on = state === "APPROVED";
  const tone = on ? MJC.green : state === "AWAITING" ? MJC.amber : MJC.mutedFg;
  return (
    <g>
      <rect x={x} y={y} width={14} height={10} rx={1.5} fill={on ? MJC.green : MJC.secondary} fillOpacity={on ? 0.85 : 1} stroke={on ? MJC.green : MJC.border} />
      <rect x={x + 5} y={y + 10} width={4} height={3} fill={MJC.border} />
      <T x={x + 18} y={y + 6} size={6.5} ls={0.5} fill={MJC.fg} opacity={0.9}>
        {operator}
      </T>
      <T x={x + 18} y={y + 14} size={6} ls={0.8} fill={tone}>
        {state}
      </T>
    </g>
  );
}
