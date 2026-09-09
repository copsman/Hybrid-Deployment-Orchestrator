"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useOrchestrator, type Packet } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { CLASS_HEX } from "@/components/shared/ClassificationBadge";
import type { EnvId } from "@/engine";
import type { Focus } from "@/engine/scenario";

type P = [number, number];
const HUB: P = [190, 290];
const SITES: Record<EnvId, P> = { cloud: [720, 120], onprem: [770, 300], airgapped: [790, 470] };
const BARRIER: P = [330, 290];
const GATE: P = [600, 470];

function quad(p0: P, c: P, p1: P, n = 14): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0];
    const y = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1];
    pts.push([x, y]);
  }
  return pts;
}

const PATHS: Record<EnvId, P[]> = {
  cloud: quad(HUB, [450, 80], SITES.cloud),
  onprem: quad(HUB, [480, 320], SITES.onprem),
  airgapped: quad(HUB, [420, 520], SITES.airgapped),
};
const REFUSED_PATH = quad(HUB, [260, 270], BARRIER, 8);

function d(pts: P[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

export function Fallback2D() {
  const packets = useOrchestrator((s) => s.packets);
  const diode = useOrchestrator((s) => s.diode);
  const focus = useDirector((s) => s.focus);
  const setFocus = useDirector((s) => s.setFocus);
  const environments = useOrchestrator((s) => s.snapshot.environments);

  return (
    <div className="absolute inset-0 bg-grid" data-testid="scene-2d">
      <svg viewBox="0 0 1000 560" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the three environments">
        <defs>
          <radialGradient id="glow" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* routes */}
        {(Object.keys(PATHS) as EnvId[]).map((env) => (
          <path key={env} d={d(PATHS[env])} fill="none" stroke="#22d3ee" strokeOpacity={focus === env ? 0.55 : 0.18} strokeWidth={1.2} strokeDasharray="4 8" className="animate-flow" />
        ))}
        <path d={d(REFUSED_PATH)} fill="none" stroke="#f43f5e" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2 6" />

        {/* perimeters */}
        <Perimeter x={620} y={40} w={340} h={160} label="PUBLIC CLOUD · EXTERNAL NETWORK" tone="#22d3ee" />
        <Perimeter x={640} y={230} w={320} h={130} label="SOVEREIGN PERIMETER · PROXIED" tone="#f59e0b" />
        <Perimeter x={640} y={400} w={320} h={130} label="ACCREDITED ENCLAVE · NO NETWORK" tone="#f43f5e" />

        {/* diode wall + gate */}
        <rect x={596} y={396} width={8} height={138} fill="url(#wall)" />
        <g transform={`translate(${GATE[0]},${GATE[1]})`}>
          <polygon points="-16,-14 14,0 -16,14" fill="#05070b" stroke="#22d3ee" strokeWidth={1.5} />
          <text x={-4} y={-22} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={9} fill="#22d3ee" letterSpacing={2}>
            DIODE
          </text>
          <text x={-4} y={34} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={8} fill="#7e8fa5" letterSpacing={1.5}>
            ONE-WAY
          </text>
        </g>

        {/* hub */}
        <g transform={`translate(${HUB[0]},${HUB[1]})`} onClick={() => setFocus("hub")} className="cursor-pointer">
          <circle r={46} fill="url(#glow)" />
          <circle r={26} fill="#0a0f17" stroke="#22d3ee" strokeWidth={1.5} />
          <circle r={34} fill="none" stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="3 5">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite" />
          </circle>
          <text y={4} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={9} fill="#d6e2f0" letterSpacing={2}>
            ROUTER
          </text>
          <text y={62} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={9} fill="#7e8fa5" letterSpacing={2}>
            POLICY PLANE
          </text>
        </g>

        {/* barrier */}
        <g transform={`translate(${BARRIER[0]},${BARRIER[1]})`}>
          <rect x={-3} y={-40} width={6} height={80} fill="#f43f5e" fillOpacity={0.5} />
          <text y={58} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={8} fill="#f43f5e" letterSpacing={2}>
            POLICY BARRIER
          </text>
        </g>

        {/* sites */}
        {environments.map((env) => {
          const id = env.spec.id;
          const [x, y] = SITES[id];
          const active = focus === id;
          const busy = env.running.length > 0;
          return (
            <g key={id} transform={`translate(${x},${y})`} onClick={() => setFocus(id)} className="cursor-pointer">
              {active && <circle r={70} fill="url(#glow)" />}
              {id === "cloud" && <CloudGlyph busy={busy} />}
              {id === "onprem" && <RackGlyph busy={busy} slots={env.spec.slots ?? 0} used={env.running.length} />}
              {id === "airgapped" && <BunkerGlyph busy={busy} slots={env.spec.slots ?? 0} used={env.running.length} />}
              <text y={id === "cloud" ? 56 : 52} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={10} fill={active ? "#22d3ee" : "#d6e2f0"} letterSpacing={3}>
                {env.spec.codename}
              </text>
              <text y={id === "cloud" ? 70 : 66} textAnchor="middle" fontFamily="var(--font-geist-sans)" fontSize={9} fill="#7e8fa5">
                {env.spec.name}
              </text>
            </g>
          );
        })}

        {/* packets */}
        <AnimatePresence>
          {packets.map((p) => (
            <PacketDot key={p.id} packet={p} />
          ))}
        </AnimatePresence>

        {/* diode chunks */}
        {diode?.active && (
          <g>
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.rect
                key={i}
                width={10}
                height={5}
                rx={1}
                fill="#f59e0b"
                initial={{ x: 470, y: 466, opacity: 0 }}
                animate={{ x: [470, 596, 700], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.27, ease: "linear" }}
              />
            ))}
          </g>
        )}
        {diode && diode.bounces > 0 && (
          <motion.circle key={`bounce-${diode.bounces}`} r={5} fill="#f43f5e" initial={{ cx: 700, cy: 480, opacity: 1 }} animate={{ cx: [700, 606, 660], cy: [480, 480, 500], opacity: [1, 1, 0] }} transition={{ duration: 1.3, ease: "easeOut" }} />
        )}
      </svg>
      <FocusBadge focus={focus} />
    </div>
  );
}

function PacketDot({ packet }: { packet: Packet }) {
  const remove = useOrchestrator((s) => s.removePacket);
  const pts = useMemo(() => (packet.to ? PATHS[packet.to] : REFUSED_PATH), [packet.to]);
  const color = CLASS_HEX[packet.classification];
  useEffect(() => {
    const id = setTimeout(() => remove(packet.id), packet.to ? 3200 : 2600);
    return () => clearTimeout(id);
  }, [packet.id, packet.to, remove]);
  return (
    <g>
      <motion.circle
        r={7}
        fill={color}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        initial={{ cx: pts[0][0], cy: pts[0][1], opacity: 0 }}
        animate={{ cx: pts.map((p) => p[0]), cy: pts.map((p) => p[1]), opacity: 1, scale: packet.to ? [1, 1, 0.6] : [1, 1, 2.2], ...(packet.to ? {} : { opacity: [1, 1, 0] }) }}
        transition={{ duration: packet.to ? 2.4 : 1.6, ease: "easeInOut" }}
        exit={{ opacity: 0 }}
      />
      <motion.text initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2.2 }} x={pts[Math.floor(pts.length / 2)][0]} y={pts[Math.floor(pts.length / 2)][1] - 14} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={9} fill={color} letterSpacing={2}>
        {packet.jobId}
      </motion.text>
    </g>
  );
}

function Perimeter({ x, y, w, h, label, tone }: { x: number; y: number; w: number; h: number; label: string; tone: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={tone} fillOpacity={0.03} stroke={tone} strokeOpacity={0.35} strokeDasharray="6 4" />
      <text x={x + 10} y={y + 14} fontFamily="var(--font-geist-mono)" fontSize={8} fill={tone} fillOpacity={0.8} letterSpacing={2}>
        {label}
      </text>
    </g>
  );
}

function CloudGlyph({ busy }: { busy: boolean }) {
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(Math.cos(a) * 28).toFixed(1)},${(Math.sin(a) * 28).toFixed(1)}`;
  }).join(" ");
  return (
    <g>
      <polygon points={hex} fill="#0a0f17" stroke="#22d3ee" strokeWidth={1.5} />
      <circle r={40} fill="none" stroke="#22d3ee" strokeOpacity={0.4} strokeDasharray="2 6">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={busy ? "4s" : "12s"} repeatCount="indefinite" />
      </circle>
      {[0, 1, 2].map((i) => (
        <circle key={i} r={3} fill="#22d3ee">
          <animateMotion dur={`${6 + i * 2}s`} repeatCount="indefinite" path={`M ${40 * Math.cos((i * 2 * Math.PI) / 3)} ${40 * Math.sin((i * 2 * Math.PI) / 3)} a 40 40 0 1 1 0.1 0`} />
        </circle>
      ))}
      <text y={4} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={8} fill="#22d3ee" letterSpacing={1}>
        ELASTIC
      </text>
    </g>
  );
}

function RackGlyph({ busy, slots, used }: { busy: boolean; slots: number; used: number }) {
  return (
    <g>
      <rect x={-30} y={-30} width={60} height={60} rx={3} fill="#0a0f17" stroke="#f59e0b" strokeWidth={1.5} />
      {Array.from({ length: slots }).map((_, i) => (
        <g key={i} transform={`translate(-22,${-22 + i * 13})`}>
          <rect width={44} height={9} rx={1} fill={i < used ? "#f59e0b" : "#101825"} fillOpacity={i < used ? 0.6 : 1} stroke="#f59e0b" strokeOpacity={0.4} />
          <circle cx={39} cy={4.5} r={1.8} fill={i < used ? "#34d399" : "#7e8fa5"}>
            {i < used && busy && <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />}
          </circle>
        </g>
      ))}
    </g>
  );
}

function BunkerGlyph({ busy, slots, used }: { busy: boolean; slots: number; used: number }) {
  return (
    <g>
      <path d="M -34 26 L -34 -6 A 34 34 0 0 1 34 -6 L 34 26 Z" fill="#0a0f17" stroke="#f43f5e" strokeWidth={1.5} />
      <rect x={-10} y={6} width={20} height={20} fill="#101825" stroke="#f43f5e" strokeOpacity={0.6} />
      {Array.from({ length: slots }).map((_, i) => (
        <circle key={i} cx={-20 + i * 40} cy={-4} r={4} fill={i < used ? "#f43f5e" : "#101825"} stroke="#f43f5e" strokeOpacity={0.6}>
          {i < used && busy && <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite" />}
        </circle>
      ))}
      <text y={-14} textAnchor="middle" fontFamily="var(--font-geist-mono)" fontSize={7} fill="#f43f5e" letterSpacing={1.5}>
        OFFLINE
      </text>
    </g>
  );
}

function FocusBadge({ focus }: { focus: Focus }) {
  const label = focus === "overview" ? "OVERVIEW" : focus === "hub" ? "POLICY ROUTER" : focus === "diode" ? "DATA DIODE" : focus.toUpperCase();
  return <div className="pointer-events-none absolute left-3 top-3 hud-label rounded-sm border border-border/60 bg-background/70 px-2 py-1 text-mjc-cyan">2D MAP · {label}</div>;
}
