"use client";

import { useMemo } from "react";
import { Edges, Instance, Instances, Line } from "@react-three/drei";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import type { EnvId } from "@/engine";
import { ENV_ACCENT, MJC } from "@/lib/palette";
import { PROXY_X, STRIP_HALF_W, STRIP_Z0, STRIP_Z1, WALL, WALL_X, ZONE_CX, ZONE_HALF_W, ZONE_ORDER, ZONE_Z0, ZONE_Z1, GATE, type V3 } from "./layout";
import { geometries, materials } from "./materials";
import { SceneText } from "./SceneText";
import { LABELS, TRUST_MARK, zoneBanner } from "./labels";
import { selSpec } from "./selectors";

function rectPoints(x0: number, x1: number, z0: number, z1: number, y: number): V3[] {
  return [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
    [x0, y, z0],
  ];
}

function ZonePlate({ id }: { id: EnvId }) {
  const spec = useOrchestrator(selSpec[id]);
  const focus = useDirector((s) => s.focus);
  const m = materials();
  const cx = ZONE_CX[id];
  const accent = ENV_ACCENT[id];
  const border = useMemo(() => rectPoints(cx - ZONE_HALF_W, cx + ZONE_HALF_W, ZONE_Z0, ZONE_Z1, 0.12), [cx]);
  return (
    <group>
      <mesh position={[cx, 0.05, (ZONE_Z0 + ZONE_Z1) / 2]} material={m.plate[id]}>
        <boxGeometry args={[ZONE_HALF_W * 2, 0.1, ZONE_Z1 - ZONE_Z0]} />
      </mesh>
      <Line points={border} color={accent} transparent opacity={0.5} lineWidth={1.2} dashed dashSize={0.6} gapSize={0.3} />
      {/* upright banner along the back edge, faces the camera */}
      <SceneText text={zoneBanner(id, spec.network)} position={[cx - 4.5, 1.9, ZONE_Z0 + 0.2]} anchorX="left" textAlign="left" fontSize={0.66} letterSpacing={0.05} lineHeight={1.25} color={accent} outlineWidth={0.03} />
      {/* trust marking engraved on the front-left corner of the plate, read at the focused preset */}
      {focus === id && <SceneText flat text={TRUST_MARK[id]} position={[cx - 4.4, 0.12, ZONE_Z1 - 0.25]} anchorX="left" textAlign="left" fontSize={0.22} color={MJC.mutedFg} outlineWidth={0.02} />}
    </group>
  );
}

function PolicyStrip() {
  const m = materials();
  const border = useMemo(() => rectPoints(-STRIP_HALF_W, STRIP_HALF_W, STRIP_Z0, STRIP_Z1, 0.12), []);
  return (
    <group>
      <mesh position={[0, 0.05, (STRIP_Z0 + STRIP_Z1) / 2]} material={m.strip}>
        <boxGeometry args={[STRIP_HALF_W * 2, 0.1, STRIP_Z1 - STRIP_Z0]} />
      </mesh>
      <Line points={border} color={MJC.cyan} transparent opacity={0.35} lineWidth={1.2} dashed dashSize={0.6} gapSize={0.3} />
      <SceneText flat text={LABELS.stripTitle} position={[-STRIP_HALF_W + 0.4, 0.12, STRIP_Z0 + 0.45]} anchorX="left" textAlign="left" fontSize={0.34} color={MJC.cyan} outlineWidth={0.02} />
    </group>
  );
}

/** Inspection-proxy checkpoint on the cloud | on-prem boundary: two posts and a lintel. */
function ProxyCheckpoint() {
  const focus = useDirector((s) => s.focus);
  const g = geometries();
  const m = materials();
  return (
    <group position={[PROXY_X, 0, -1.9]}>
      <Instances limit={3} frames={1} geometry={g.unitBox} material={m.white}>
        <Instance position={[0, 0.8, -0.7]} scale={[0.15, 1.6, 0.15]} color={MJC.amber} />
        <Instance position={[0, 0.8, 0.7]} scale={[0.15, 1.6, 0.15]} color={MJC.amber} />
        <Instance position={[0, 1.6, 0]} scale={[0.15, 0.15, 1.55]} color={MJC.amber} />
      </Instances>
      {focus === "onprem" && <SceneText text={LABELS.proxy} position={[0, 1.95, 0]} fontSize={0.14} color={MJC.amber} outlineWidth={0.02} />}
    </group>
  );
}

/** The diode wall: a solid barrier with one real doorway around the gate ring. */
function DiodeWall() {
  const m = materials();
  const doorHalf = 0.8;
  const doorTop = GATE[1] + 0.8;
  const backLen = GATE[2] - doorHalf - WALL.z0;
  const frontLen = WALL.z1 - (GATE[2] + doorHalf);
  return (
    <group>
      <mesh position={[WALL_X, WALL.height / 2, WALL.z0 + backLen / 2]} material={m.wall}>
        <boxGeometry args={[WALL.thickness, WALL.height, backLen]} />
        <Edges color={MJC.red} threshold={15} />
      </mesh>
      <mesh position={[WALL_X, WALL.height / 2, WALL.z1 - frontLen / 2]} material={m.wall}>
        <boxGeometry args={[WALL.thickness, WALL.height, frontLen]} />
        <Edges color={MJC.red} threshold={15} />
      </mesh>
      <mesh position={[WALL_X, (doorTop + WALL.height) / 2, GATE[2]]} material={m.wall}>
        <boxGeometry args={[WALL.thickness, WALL.height - doorTop, doorHalf * 2]} />
      </mesh>
    </group>
  );
}

/** Three zone plates with borders, banners and trust marks; the policy strip; the proxy checkpoint; the diode wall. */
export function Zones() {
  return (
    <group>
      {ZONE_ORDER.map((id) => (
        <ZonePlate key={id} id={id} />
      ))}
      <PolicyStrip />
      <ProxyCheckpoint />
      <DiodeWall />
    </group>
  );
}
