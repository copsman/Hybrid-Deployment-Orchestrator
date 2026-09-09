"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges, Float, Html, Line } from "@react-three/drei";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import type { EnvId } from "@/engine";
import { HUB, SITES, BARRIER, routeCurve, refusedCurve } from "./layout";

const CYAN = "#22d3ee";
const AMBER = "#f59e0b";
const RED = "#f43f5e";

function Label({ title, sub, tone = CYAN, active }: { title: string; sub: string; tone?: string; active?: boolean }) {
  return (
    <Html center distanceFactor={14} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap text-center">
        <div className="font-mono text-[11px] tracking-[0.3em]" style={{ color: active ? tone : "#d6e2f0", textShadow: active ? `0 0 10px ${tone}` : undefined }}>
          {title}
        </div>
        <div className="text-[10px] text-[#7e8fa5]">{sub}</div>
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
    <group position={BARRIER}>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.6, 1.6]} />
        <meshStandardMaterial ref={mat} color={RED} emissive={RED} emissiveIntensity={0.4} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.6, 1.6]} />
        <meshBasicMaterial color={RED} wireframe transparent opacity={0.35} />
      </mesh>
      <group position={[0, 1.2, 0]}>
        <Label title="POLICY BARRIER" sub="refused requests stop here" tone={RED} />
      </group>
    </group>
  );
}

export function CloudSite() {
  const env = useOrchestrator((s) => s.snapshot.environments[0]);
  const focus = useDirector((s) => s.focus);
  const orbit = useRef<THREE.Group>(null);
  const busy = env.running.length > 0;
  useFrame((_, dt) => {
    if (orbit.current) orbit.current.rotation.y += dt * (busy ? 1.6 : 0.5);
  });
  return (
    <group position={SITES.cloud}>
      <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.6}>
        <mesh>
          <cylinderGeometry args={[1.5, 1.5, 0.18, 6]} />
          <meshStandardMaterial color="#0a0f17" metalness={0.7} roughness={0.35} />
          <Edges color={CYAN} threshold={15} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <icosahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color="#083344" emissive={CYAN} emissiveIntensity={busy ? 2.2 : 1} />
        </mesh>
        <group ref={orbit}>
          {[0, 1, 2, 3].map((i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 2.1, 0.4 + Math.sin(a * 2) * 0.2, Math.sin(a) * 2.1]}>
                <sphereGeometry args={[0.12, 12, 12]} />
                <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={2} />
              </mesh>
            );
          })}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.4, 0]}>
            <torusGeometry args={[2.1, 0.012, 6, 96]} />
            <meshBasicMaterial color={CYAN} transparent opacity={0.5} />
          </mesh>
        </group>
      </Float>
      {/* light shaft to the ground */}
      <mesh position={[0, -SITES.cloud[1] / 2, 0]}>
        <cylinderGeometry args={[0.25, 1.2, SITES.cloud[1], 24, 1, true]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1.5, 0]} color={CYAN} intensity={busy ? 8 : 4} distance={9} />
      <group position={[0, 2.2, 0]}>
        <Label title="CLOUD" sub="Meridian Cloud Region North · elastic · external" active={focus === "cloud"} />
      </group>
    </group>
  );
}

export function OnPremSite() {
  const env = useOrchestrator((s) => s.snapshot.environments[1]);
  const focus = useDirector((s) => s.focus);
  const slots = env.spec.slots ?? 4;
  const used = env.running.length;
  return (
    <group position={SITES.onprem}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[4.4, 0.1, 3.2]} />
        <meshStandardMaterial color="#0a0f17" metalness={0.5} roughness={0.5} />
        <Edges color={AMBER} threshold={15} />
      </mesh>
      {[-1.2, 0, 1.2].map((x, r) => (
        <group key={r} position={[x, 0.85, 0]}>
          <mesh>
            <boxGeometry args={[0.9, 1.6, 1.1]} />
            <meshStandardMaterial color="#0d1420" metalness={0.6} roughness={0.4} />
            <Edges color={AMBER} threshold={15} />
          </mesh>
          {Array.from({ length: 4 }).map((_, i) => {
            const slotIndex = r * 4 + i;
            const lit = r === 1 ? i < used : slotIndex % 3 === 0;
            const isGpu = r === 1;
            return (
              <mesh key={i} position={[0, -0.55 + i * 0.36, 0.56]}>
                <boxGeometry args={[0.72, 0.22, 0.02]} />
                <meshStandardMaterial color={isGpu ? (lit ? AMBER : "#1a2433") : "#141c29"} emissive={isGpu && lit ? AMBER : "#000"} emissiveIntensity={lit ? 1.4 : 0} />
              </mesh>
            );
          })}
        </group>
      ))}
      <pointLight position={[0, 2.2, 1.5]} color={AMBER} intensity={used ? 5 : 2} distance={8} />
      <group position={[0, 2.6, 0]}>
        <Label title="ON-PREM" sub={`Fort Meridian Datacentre · ${used}/${slots} GPU · proxied`} tone={AMBER} active={focus === "onprem"} />
      </group>
    </group>
  );
}

export function EnclaveSite() {
  const env = useOrchestrator((s) => s.snapshot.environments[2]);
  const focus = useDirector((s) => s.focus);
  const used = env.running.length;
  const slots = env.spec.slots ?? 2;
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z -= dt * 0.35;
  });
  return (
    <group position={SITES.airgapped}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[2.4, 2.6, 0.1, 8]} />
        <meshStandardMaterial color="#0a0f17" metalness={0.5} roughness={0.5} />
        <Edges color={RED} threshold={15} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#110a10" metalness={0.4} roughness={0.7} />
        <Edges color={RED} threshold={40} />
      </mesh>
      <mesh position={[-1.3, 0.45, 0.6]} rotation={[0, -0.6, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.1]} />
        <meshStandardMaterial color="#1a0f14" emissive={RED} emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={ring} position={[0, 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.9, 0.02, 6, 96]} />
        <meshBasicMaterial color={RED} transparent opacity={0.6} />
      </mesh>
      {Array.from({ length: slots }).map((_, i) => (
        <mesh key={i} position={[-0.4 + i * 0.8, 1.62, 0]}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color={i < used ? RED : "#2a1a20"} emissive={i < used ? RED : "#000"} emissiveIntensity={2} />
        </mesh>
      ))}
      <pointLight position={[0, 1.8, 0]} color={RED} intensity={used ? 5 : 2.5} distance={8} />
      <group position={[0, 2.8, 0]}>
        <Label title="AIR-GAPPED" sub={`Enclave OBSIDIAN · ${used}/${slots} GPU · no network`} tone={RED} active={focus === "airgapped"} />
      </group>
    </group>
  );
}
