"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Trail } from "@react-three/drei";
import { useOrchestrator, type Packet } from "@/store/orchestrator";
import { CLASS_HEX } from "@/lib/palette";
import { PACKET_TIMING, refusedCurve, routeCurve } from "./layout";
import { SceneText, type SceneTextHandle } from "./SceneText";
import { packetTag } from "./labels";

const TMP = new THREE.Vector3();

function easeInOut(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

export function Packets() {
  const packets = useOrchestrator((s) => s.packets);
  return (
    <group>
      {packets.map((p) => (
        <PacketMesh key={p.id} packet={p} />
      ))}
    </group>
  );
}

/**
 * One job in flight: hub → arch → site gate for routed and queued jobs (the queue token
 * appears from state on arrival), hub → arch and a burst for refused jobs, timed so the
 * barrier flash lands with it. The removal timer starts on the first rendered frame, the
 * same moment the flight clock latches, so a late first frame can never cut a flight short.
 */
function PacketMesh({ packet }: { packet: Packet }) {
  const remove = useOrchestrator((s) => s.removePacket);
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const label = useRef<SceneTextHandle>(null);
  const curve = useMemo(() => (packet.to ? routeCurve(packet.to) : refusedCurve()), [packet.to]);
  const color = CLASS_HEX[packet.classification];
  const trailColor = useMemo(() => new THREE.Color(color), [color]);
  const t0 = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const travel = packet.to ? PACKET_TIMING.route : PACKET_TIMING.refuse;
  const lifetime = packet.to ? PACKET_TIMING.route + 0.4 : PACKET_TIMING.refuse + PACKET_TIMING.burst + 0.3;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    const m = mesh.current;
    const material = mat.current;
    if (!g || !m || !material) return;
    if (t0.current === null) {
      t0.current = state.clock.elapsedTime;
      timer.current = setTimeout(() => remove(packet.id), lifetime * 1000);
    }
    const el = state.clock.elapsedTime - t0.current;
    const u = Math.min(1, el / travel);
    curve.getPoint(easeInOut(u), TMP);
    g.position.copy(TMP);
    m.rotation.x += dt * 3.0;
    m.rotation.y += dt * 1.9;
    if (packet.to) {
      const s = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
      m.scale.setScalar(0.22 * Math.max(0.001, s));
      material.opacity = 1;
      if (label.current) label.current.fillOpacity = s;
    } else if (u >= 1) {
      const k = Math.min(1, (el - travel) / PACKET_TIMING.burst);
      m.scale.setScalar(0.22 * (1 + k * 4));
      material.opacity = 1 - k;
      if (label.current) label.current.fillOpacity = 1 - k;
    }
  });

  return (
    <group ref={group}>
      <Trail width={0.6} length={5} color={trailColor} attenuation={(w) => w * w}>
        <mesh ref={mesh} scale={0.22}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={2.5} transparent toneMapped={false} />
        </mesh>
      </Trail>
      {/* a sibling of the burst mesh, so the label keeps its size while the packet swells */}
      <Billboard position={[0, 0.45, 0]}>
        <SceneText text={packetTag(packet.jobId, packet.classification)} fontSize={0.18} color={color} outlineWidth={0.04} textRef={label} />
      </Billboard>
    </group>
  );
}
