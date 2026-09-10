"use client";

import { useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { ENV_ACCENT, MJC } from "@/lib/palette";
import type { EnvId } from "@/engine";
import type { Focus } from "@/engine/scenario";
import { ENV_IDS_ORDERED } from "./selectors";
import { FAN, PROXY, TRUNK, TRUST_MARK, VIEW_H, VIEW_W, WALL, ZONE_NO, ZONE_W, ZONE_WORD, ZONE_X, ZONE_Y0, ZONE_Y1, pathD } from "./map2d/geometry";
import { T, useStill } from "./map2d/primitives";
import { Campus } from "./map2d/Campus";
import { Diode } from "./map2d/Diode";
import { ArtefactToken } from "./map2d/Artefact";
import { Barrier, Bench, Hub, Obelisk, Strip } from "./map2d/PolicyPlane";
import { PacketDot } from "./map2d/Packets";

/**
 * The 2D map: the same left-to-right security gradient as the 3D scene.
 * PERIMETER 01 CLOUD | PERIMETER 02 SOVEREIGN | data-diode wall | PERIMETER 03 ENCLAVE
 * across the top, the POLICY PLANE strip (bench, router, ledger) along the bottom and the
 * policy-barrier arch between them. Everything on it is read from the engine snapshot.
 */
export function Fallback2D() {
  const packets = useOrchestrator((s) => s.packets);
  const focus = useDirector((s) => s.focus);
  const setFocus = useDirector((s) => s.setFocus);
  const still = useStill();
  const active = useMemo(() => {
    const set = new Set<EnvId>();
    for (const p of packets) if (p.to) set.add(p.to);
    return set;
  }, [packets]);

  return (
    <div className="absolute inset-0 bg-grid" data-testid="scene-2d">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the three perimeters and the policy plane">
        <defs>
          {ENV_IDS_ORDERED.map((id) => (
            <radialGradient key={id} id={`glow-${id}`} r="50%">
              <stop offset="0%" stopColor={ENV_ACCENT[id]} stopOpacity="0.3" />
              <stop offset="100%" stopColor={ENV_ACCENT[id]} stopOpacity="0" />
            </radialGradient>
          ))}
          <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={MJC.red} stopOpacity="0.6" />
            <stop offset="100%" stopColor={MJC.red} stopOpacity="0.2" />
          </linearGradient>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke={MJC.red} strokeOpacity="0.16" strokeWidth="1" />
          </pattern>
        </defs>

        {/* perimeters, left to right by trust */}
        {ENV_IDS_ORDERED.map((id) => (
          <Zone key={id} id={id} focused={focus === id} onSelect={() => setFocus(id)} />
        ))}
        <Strip />

        {/* the diode wall: the only crossing into the enclave */}
        <rect x={WALL.x} y={ZONE_Y0} width={WALL.w} height={ZONE_Y1 - ZONE_Y0} fill="url(#wall)" />

        {/* routes: one trunk through the arch, then the fan */}
        <path d={pathD(TRUNK)} fill="none" stroke={MJC.cyan} strokeOpacity={0.5} strokeWidth={1.4} strokeDasharray="4 8" className={still ? undefined : "animate-flow"} />
        {ENV_IDS_ORDERED.map((id) => {
          const hot = focus === id || active.has(id);
          return <path key={id} d={pathD(FAN[id])} fill="none" stroke={MJC.cyan} strokeOpacity={hot ? 0.6 : 0.2} strokeWidth={hot ? 1.6 : 1.2} strokeDasharray="4 8" className={still ? undefined : "animate-flow"} />;
        })}

        {/* inspection proxy: the sovereign perimeter's only way out */}
        <g>
          <rect x={PROXY.x - 5} y={PROXY.y0} width={3} height={PROXY.y1 - PROXY.y0} fill={MJC.amber} fillOpacity={0.8} />
          <rect x={PROXY.x + 2} y={PROXY.y0} width={3} height={PROXY.y1 - PROXY.y0} fill={MJC.amber} fillOpacity={0.8} />
          <rect x={PROXY.x - 7} y={PROXY.y0 - 2} width={14} height={2.5} fill={MJC.amber} fillOpacity={0.9} />
          <T x={PROXY.x} y={PROXY.y1 + 10} size={5.5} ls={1} anchor="middle" fill={MJC.amber}>
            PROXY
          </T>
        </g>

        {ENV_IDS_ORDERED.map((id) => (
          <Campus key={id} id={id} focused={focus === id} onSelect={() => setFocus(id)} />
        ))}
        <Diode focused={focus === "diode"} onSelect={() => setFocus("diode")} />

        <Barrier />
        <Bench />
        <Obelisk />
        <Hub focused={focus === "hub"} onSelect={() => setFocus("hub")} />

        <ArtefactToken />
        <AnimatePresence>
          {packets.map((p) => (
            <PacketDot key={p.id} packet={p} />
          ))}
        </AnimatePresence>
      </svg>
      <FocusBadge focus={focus} />
    </div>
  );
}

function Zone({ id, focused, onSelect }: { id: EnvId; focused: boolean; onSelect: () => void }) {
  const accent = ENV_ACCENT[id];
  const x = ZONE_X[id];
  return (
    <g onClick={onSelect} className="cursor-pointer">
      <rect x={x} y={ZONE_Y0} width={ZONE_W} height={ZONE_Y1 - ZONE_Y0} rx={6} fill={accent} fillOpacity={focused ? 0.05 : 0.03} stroke={accent} strokeOpacity={focused ? 0.8 : 0.35} strokeWidth={focused ? 1.5 : 1} strokeDasharray="6 4" />
      <T x={x + 10} y={ZONE_Y0 + 16} size={9} ls={2} fill={accent} opacity={0.9}>
        {`PERIMETER ${ZONE_NO[id]} · ${ZONE_WORD[id]}`}
      </T>
      <T x={x + ZONE_W - 10} y={ZONE_Y0 + 16} size={6.5} ls={1} anchor="end" fill={MJC.mutedFg}>
        {TRUST_MARK[id]}
      </T>
    </g>
  );
}

function FocusBadge({ focus }: { focus: Focus }) {
  const label = focus === "overview" ? "OVERVIEW" : focus === "hub" ? "POLICY ROUTER" : focus === "diode" ? "DATA DIODE" : focus.toUpperCase();
  return <div className="pointer-events-none absolute left-3 top-3 hud-label rounded-sm border border-border/60 bg-background/70 px-2 py-1 text-mjc-cyan">2D MAP · {label}</div>;
}
