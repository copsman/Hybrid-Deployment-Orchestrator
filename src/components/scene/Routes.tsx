"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import type { EnvId } from "@/engine";
import { MJC } from "@/lib/palette";
import { ROUTE_LINES, ZONE_ORDER } from "./layout";

/** Dash flow speed in world units per second: the 3D twin of the 2D map's animate-flow. */
const FLOW = 1.2;

/** Trunk hub → arch plus the three fan routes; dashes flow, the focused or active route brightens. */
export function Routes() {
  const focus = useDirector((s) => s.focus);
  const packets = useOrchestrator((s) => s.packets);
  const activeKey = useMemo(() => {
    const set = new Set<EnvId>();
    for (const p of packets) if (p.to) set.add(p.to);
    return ZONE_ORDER.filter((id) => set.has(id)).join(",");
  }, [packets]);
  const active = useMemo(() => new Set(activeKey ? activeKey.split(",") : []), [activeKey]);
  const trunk = useRef<Line2>(null);
  const fans = useRef<Record<EnvId, Line2 | null>>({ cloud: null, onprem: null, airgapped: null });

  useFrame((_, dt) => {
    const step = dt * FLOW;
    if (trunk.current) trunk.current.material.dashOffset -= step;
    for (const id of ZONE_ORDER) {
      const line = fans.current[id];
      if (line) line.material.dashOffset -= step;
    }
  });

  return (
    <group>
      <Line ref={trunk} points={ROUTE_LINES.trunk} color={MJC.cyan} transparent opacity={0.5} lineWidth={1.4} dashed dashSize={0.25} gapSize={0.3} />
      {ZONE_ORDER.map((id) => {
        const hot = focus === id || active.has(id);
        return (
          <Line
            key={id}
            ref={(line) => {
              fans.current[id] = line as Line2 | null;
            }}
            points={ROUTE_LINES[id]}
            color={MJC.cyan}
            transparent
            opacity={hot ? 0.85 : 0.22}
            lineWidth={hot ? 1.8 : 1}
            dashed
            dashSize={0.25}
            gapSize={0.3}
          />
        );
      })}
    </group>
  );
}
