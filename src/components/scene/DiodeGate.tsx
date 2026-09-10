"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { GATE, WALL_X } from "./layout";

const CYAN = "#22d3ee";
const AMBER = "#f59e0b";
const RED = "#f43f5e";
const CHUNKS = 10;
const LOW_X = WALL_X - 1.6;
const HIGH_X = WALL_X + 1.6;

export function DiodeGate() {
  const diode = useOrchestrator((s) => s.diode);
  const focus = useDirector((s) => s.focus);
  const inst = useRef<THREE.InstancedMesh>(null);
  const bounce = useRef<THREE.Mesh>(null);
  const gateMat = useRef<THREE.MeshStandardMaterial>(null);
  const seenBounces = useRef(0);
  const bounceT = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => Array.from({ length: CHUNKS }, (_, i) => i / CHUNKS), []);
  const active = !!diode?.active;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (inst.current) {
      for (let i = 0; i < CHUNKS; i++) {
        const p = active ? (t * 0.55 + offsets[i]) % 1 : -1;
        if (p < 0) {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.0001);
        } else {
          const x = LOW_X + p * (HIGH_X - LOW_X);
          const y = GATE[1] + Math.sin(p * Math.PI) * 0.35 + Math.sin(t * 6 + i) * 0.03;
          const z = GATE[2] + Math.sin(i * 1.7) * 0.25;
          dummy.position.set(x, y, z);
          const fade = p < 0.1 ? p / 0.1 : p > 0.9 ? (1 - p) / 0.1 : 1;
          dummy.scale.set(0.34 * fade, 0.12 * fade, 0.12 * fade);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        inst.current.setMatrixAt(i, dummy.matrix);
      }
      inst.current.instanceMatrix.needsUpdate = true;
    }
    if (gateMat.current) gateMat.current.emissiveIntensity = active ? 2.4 + Math.sin(t * 8) * 0.6 : 1;

    // Return-path bounce: something on the high side tries to send back, hits the gate, drops.
    if (diode && diode.bounces > seenBounces.current) {
      seenBounces.current = diode.bounces;
      bounceT.current = 0;
    }
    if (bounce.current) {
      if (bounceT.current >= 0) {
        bounceT.current += dt;
        const tt = bounceT.current;
        const approach = Math.min(1, tt / 0.8);
        let x = HIGH_X - 0.6 - approach * (HIGH_X - 0.6 - (WALL_X + 0.25));
        let y = GATE[1];
        let s = 0.16;
        if (tt > 0.8) {
          const k = Math.min(1, (tt - 0.8) / 0.7);
          x = WALL_X + 0.25 + k * 1.2;
          y = GATE[1] + Math.sin(k * Math.PI) * 0.6 - k * 0.7;
          s = 0.16 * (1 - k);
        }
        bounce.current.position.set(x, y, GATE[2]);
        bounce.current.scale.setScalar(Math.max(0.0001, s));
        bounce.current.visible = true;
        if (tt > 1.6) bounceT.current = -1;
      } else {
        bounce.current.visible = false;
      }
    }
  });

  return (
    <group>
      {/* gate ring + direction cone */}
      <mesh position={GATE} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.7, 0.05, 10, 48]} />
        <meshStandardMaterial ref={gateMat} color={CYAN} emissive={CYAN} emissiveIntensity={1} />
      </mesh>
      <mesh position={[GATE[0] + 0.05, GATE[1], GATE[2]]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.28, 0.6, 12]} />
        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.8} transparent opacity={0.85} />
      </mesh>
      {/* opening in the wall is implied by the ring; add a glowing disc */}
      <mesh position={GATE} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.66, 32]} />
        <meshBasicMaterial color={CYAN} transparent opacity={active ? 0.22 : 0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <instancedMesh ref={inst} args={[undefined, undefined, CHUNKS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={AMBER} emissive={AMBER} emissiveIntensity={2} />
      </instancedMesh>
      <mesh ref={bounce} visible={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={3} />
      </mesh>
      <pointLight position={[GATE[0], GATE[1] + 0.6, GATE[2]]} color={CYAN} intensity={active ? 8 : 2} distance={6} />
      <group position={[GATE[0], GATE[1] + 1.5, GATE[2]]}>
        <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap text-center select-none">
            <div className="font-mono text-[10px] tracking-[0.3em]" style={{ color: focus === "diode" || active ? CYAN : "#d6e2f0", textShadow: active ? `0 0 10px ${CYAN}` : "0 1px 2px rgba(0,0,0,0.8)" }}>
              DATA DIODE
            </div>
            <div className="text-[9px] text-[#93a4ba]" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}>{active && diode ? `one-way · ${diode.sent}/${diode.total} chunks · ${diode.bounces} return attempt${diode.bounces === 1 ? "" : "s"} blocked` : "one-way · no return channel"}</div>
          </div>
        </Html>
      </group>
    </group>
  );
}
