"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import { useOrchestrator, type Packet } from "@/store/orchestrator";
import { CLASS_HEX } from "@/lib/palette";
import { routeCurve, refusedCurve } from "./layout";

const ROUTE_SECONDS = 2.6;
const REFUSE_SECONDS = 1.5;

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

function PacketMesh({ packet }: { packet: Packet }) {
  const remove = useOrchestrator((s) => s.removePacket);
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const curve = useMemo(() => (packet.to ? routeCurve(packet.to) : refusedCurve()), [packet.to]);
  const color = CLASS_HEX[packet.classification];
  const t0 = useRef<number | null>(null);
  const total = packet.to ? ROUTE_SECONDS : REFUSE_SECONDS + 0.7;

  useEffect(() => {
    const id = setTimeout(() => remove(packet.id), (total + 0.4) * 1000);
    return () => clearTimeout(id);
  }, [packet.id, remove, total]);

  useFrame((state) => {
    if (!mesh.current || !mat.current) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const el = state.clock.elapsedTime - t0.current;
    const travel = packet.to ? ROUTE_SECONDS : REFUSE_SECONDS;
    const u = Math.min(1, el / travel);
    const eased = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const p = curve.getPoint(eased);
    mesh.current.position.copy(p);
    mesh.current.rotation.x += 0.08;
    mesh.current.rotation.y += 0.05;
    if (packet.to) {
      const s = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
      mesh.current.scale.setScalar(0.22 * Math.max(0.001, s));
      mat.current.opacity = 1;
    } else if (u >= 1) {
      const k = Math.min(1, (el - travel) / 0.7);
      mesh.current.scale.setScalar(0.22 * (1 + k * 4));
      mat.current.opacity = 1 - k;
    }
  });

  return (
    <Trail width={0.6} length={5} color={new THREE.Color(color)} attenuation={(w) => w * w}>
      <mesh ref={mesh} scale={0.22}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={2.5} transparent />
      </mesh>
    </Trail>
  );
}
