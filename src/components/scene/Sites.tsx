"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges, Html, Line } from "@react-three/drei";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import type { EnvId } from "@/engine";
import { HUB, ARCH, routeCurve, refusedCurve } from "./layout";

const CYAN = "#22d3ee";
const RED = "#f43f5e";

function Label({ title, sub, tone = CYAN, active }: { title: string; sub: string; tone?: string; active?: boolean }) {
  return (
    <Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap text-center select-none">
        <div className="font-mono text-[10px] tracking-[0.3em]" style={{ color: active ? tone : "#d6e2f0", textShadow: active ? `0 0 10px ${tone}` : "0 1px 2px rgba(0,0,0,0.8)" }}>
          {title}
        </div>
        <div className="text-[9px] text-[#93a4ba]" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}>{sub}</div>
      </div>
    </Html>
  );
}

export function Routes() {
  const focus = useDirector((s) => s.focus);
  const pts = useMemo(
    () => ({
      cloud: routeCurve("cloud").getPoints(40),
      onprem: routeCurve("onprem").getPoints(40),
      airgapped: routeCurve("airgapped").getPoints(40),
      refused: refusedCurve().getPoints(16),
    }),
    [],
  );
  return (
    <group>
      {(["cloud", "onprem", "airgapped"] as EnvId[]).map((env) => (
        <Line key={env} points={pts[env]} color={CYAN} transparent opacity={focus === env ? 0.75 : 0.22} lineWidth={focus === env ? 1.6 : 1} dashed dashSize={0.25} gapSize={0.35} />
      ))}
      <Line points={pts.refused} color={RED} transparent opacity={0.2} lineWidth={1} dashed dashSize={0.12} gapSize={0.25} />
    </group>
  );
}

export function Hub() {
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const packets = useOrchestrator((s) => s.packets.length);
  const focus = useDirector((s) => s.focus);
  useFrame((state, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.6;
    if (core.current) {
      const t = state.clock.elapsedTime;
      const s = 1 + Math.sin(t * 3) * 0.04 + (packets ? 0.12 : 0);
      core.current.scale.setScalar(s);
    }
  });
  return (
    <group position={HUB}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.6, 1.8, 0.16, 32]} />
        <meshStandardMaterial color="#0a0f17" metalness={0.6} roughness={0.4} />
        <Edges color={CYAN} threshold={20} />
      </mesh>
      <mesh ref={ring} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.15, 0.03, 8, 64]} />
        <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={1.6} />
      </mesh>
      <mesh ref={core} position={[0, 0.9, 0]}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial color="#0b3a44" emissive={CYAN} emissiveIntensity={1.2} wireframe />
      </mesh>
      <pointLight position={[0, 1.6, 0]} color={CYAN} intensity={6} distance={7} />
      <group position={[0, 2.4, 0]}>
        <Label title="ROUTER" sub="policy plane · deny by default" active={focus === "hub"} />
      </group>
    </group>
  );
}

export function Barrier() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const alert = useOrchestrator((s) => s.alert);
  const flash = useRef(0);
  const lastAt = useRef(0);
  useFrame((_, dt) => {
    if (alert && alert.at !== lastAt.current) {
      lastAt.current = alert.at;
      flash.current = 1;
    }
    flash.current = Math.max(0, flash.current - dt * 0.8);
    if (mat.current) {
      mat.current.opacity = 0.12 + flash.current * 0.55;
      mat.current.emissiveIntensity = 0.4 + flash.current * 3;
    }
  });
  return (
    <group position={[ARCH[0], 0.85, ARCH[2]]}>
      <mesh>
        <planeGeometry args={[2.6, 1.6]} />
        <meshStandardMaterial ref={mat} color={RED} emissive={RED} emissiveIntensity={0.4} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[2.6, 1.6]} />
        <meshBasicMaterial color={RED} wireframe transparent opacity={0.35} />
      </mesh>
      <group position={[0, 1.2, 0]}>
        <Label title="POLICY BARRIER" sub="refused requests stop here" tone={RED} />
      </group>
    </group>
  );
}
