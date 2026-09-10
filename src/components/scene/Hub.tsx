"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Edges, Instance, Instances, ScreenSizer } from "@react-three/drei";
import { POLICY } from "@/engine";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { MJC } from "@/lib/palette";
import { ARCH, BENCH, HUB, PACKET_TIMING } from "./layout";
import { geometries, materials } from "./materials";
import { SceneText, type SceneTextHandle } from "./SceneText";
import { LABELS, hubSubtitle, refusedVerdict, routedVerdict } from "./labels";
import { parseImportKey, selDecisions, selImportKey, selLastPacket, selPacketCount, selResetSeq } from "./selectors";

/** The policy router: single entry point of the world, headline carries the real policy version. */
export function Hub() {
  const decisions = useOrchestrator(selDecisions);
  const packets = useOrchestrator(selPacketCount);
  const focus = useDirector((s) => s.focus);
  const m = materials();
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    if (ring.current) ring.current.rotation.z += dt * 0.6;
    if (core.current) core.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.04 + (packets ? 0.12 : 0));
  });

  return (
    <group position={HUB}>
      <mesh position={[0, 0.08, 0]} material={m.pad}>
        <cylinderGeometry args={[1.5, 1.7, 0.16, 32]} />
        <Edges color={MJC.cyan} threshold={20} />
      </mesh>
      {/* an open arc so the spin is visible */}
      <mesh ref={ring} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.accent.cyan}>
        <torusGeometry args={[1.1, 0.03, 8, 64, Math.PI * 1.7]} />
      </mesh>
      <mesh ref={core} position={[0, 0.9, 0]}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial color="#0b3a44" emissive={MJC.cyan} emissiveIntensity={1.2} wireframe toneMapped={false} />
      </mesh>
      <Billboard position={[0, 2.4, 0]}>
        <ScreenSizer>
          <SceneText screen text={LABELS.hub} fontSize={12} letterSpacing={0.25} color={focus === "hub" ? MJC.cyan : MJC.fg} />
          <SceneText screen text={hubSubtitle(POLICY.version, decisions)} fontSize={8.5} letterSpacing={0.08} color={MJC.mutedFg} anchorY="top" position={[0, -8, 0]} />
        </ScreenSizer>
      </Billboard>
    </group>
  );
}

/** Build-and-sign bench on the low side; the bundle token itself is owned by ArtefactFlow. */
export function Bench() {
  const importKey = useOrchestrator(selImportKey);
  const staged = useMemo(() => {
    const state = parseImportKey(importKey).state;
    return state === "BUILT" || state === "SIGNED";
  }, [importKey]);
  const m = materials();
  return (
    <group position={BENCH}>
      <mesh position={[0, 0.25, 0]} material={m.body}>
        <boxGeometry args={[0.9, 0.5, 0.6]} />
        <Edges color={MJC.cyan} threshold={15} />
      </mesh>
      {staged && (
        <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glow.cyan}>
          <circleGeometry args={[0.35, 24]} />
        </mesh>
      )}
      <SceneText flat text={LABELS.bench} position={[0, 0.12, 0.72]} fontSize={0.14} color={MJC.cyan} outlineWidth={0.02} />
    </group>
  );
}

const FIELD_RED = new THREE.Color(MJC.red);
const FIELD_CYAN = new THREE.Color(MJC.cyan);
const REFUSE_MS = PACKET_TIMING.refuse * 1000;
const FLASH_SECONDS = 2.2;
const PULSE_TEXT_SECONDS = 1.8;

/**
 * The policy barrier arch: every routed packet passes it (cyan pulse with the verdict),
 * every refused packet bursts against it (red flash with the rule id). The refusal flash
 * is scheduled for the moment the packet arrives and is dropped on reset or when the
 * alert clears, so a stale verdict can never appear over a clean sandbox.
 */
export function Barrier() {
  const alert = useOrchestrator((s) => s.alert);
  const last = useOrchestrator(selLastPacket);
  const resetSeq = useOrchestrator(selResetSeq);
  const g = geometries();
  const m = materials();
  const field = useRef<THREE.MeshStandardMaterial>(null);
  const textGroup = useRef<THREE.Group>(null);
  const text = useRef<SceneTextHandle>(null);
  const flash = useRef(0);
  const pulse = useRef(0);
  const fireAt = useRef<number | null>(null);
  const fireRule = useRef<string | null>(null);
  const textUntil = useRef(0);
  const seenAlert = useRef(0);
  const seenPacket = useRef<string | null>(null);
  const seenReset = useRef(resetSeq);
  const frameColor = useMemo(() => "#" + new THREE.Color(MJC.cyan).multiplyScalar(0.6).getHexString(), []);

  useFrame((_, dt) => {
    const mat = field.current;
    const grp = textGroup.current;
    const label = text.current;
    if (!mat || !grp || !label) return;
    const now = Date.now();

    if (resetSeq !== seenReset.current) {
      seenReset.current = resetSeq;
      fireAt.current = null;
      flash.current = 0;
      pulse.current = 0;
      textUntil.current = 0;
      seenAlert.current = 0;
      seenPacket.current = null;
      grp.visible = false;
    }
    if (alert === null) fireAt.current = null;
    else if (alert.at !== seenAlert.current) {
      seenAlert.current = alert.at;
      fireAt.current = alert.at + REFUSE_MS;
      fireRule.current = alert.ruleId;
    }
    if (last && last.id !== seenPacket.current) {
      seenPacket.current = last.id;
      if (last.to) {
        pulse.current = 1;
        label.text = routedVerdict(last.jobId, last.to, last.position);
        label.color = MJC.cyan;
        textUntil.current = now + PULSE_TEXT_SECONDS * 1000;
        grp.visible = true;
      }
    }
    if (fireAt.current !== null && now >= fireAt.current) {
      fireAt.current = null;
      flash.current = 1;
      label.text = refusedVerdict(fireRule.current);
      label.color = MJC.red;
      textUntil.current = now + FLASH_SECONDS * 1000;
      grp.visible = true;
    }

    if (flash.current === 0 && pulse.current === 0 && fireAt.current === null && !grp.visible) return;

    if (flash.current > 0) flash.current = Math.max(0, flash.current - dt / FLASH_SECONDS);
    if (pulse.current > 0) pulse.current = Math.max(0, pulse.current - dt * 1.6);
    mat.opacity = 0.1 + flash.current * 0.55 + pulse.current * 0.25;
    mat.emissiveIntensity = 0.4 + flash.current * 3 + pulse.current * 1.5;
    mat.emissive.lerpColors(FIELD_RED, FIELD_CYAN, pulse.current);
    mat.color.copy(mat.emissive);
    if (grp.visible) {
      const remaining = (textUntil.current - now) / 1000;
      if (remaining <= 0) grp.visible = false;
      else label.fillOpacity = Math.min(1, remaining / 0.5);
    }
  });

  return (
    <group position={ARCH}>
      <Instances limit={3} frames={1} geometry={g.unitBox} material={m.unlit}>
        <Instance position={[-1.3, 0.85, 0]} scale={[0.18, 1.7, 0.18]} color={frameColor} />
        <Instance position={[1.3, 0.85, 0]} scale={[0.18, 1.7, 0.18]} color={frameColor} />
        <Instance position={[0, 1.7, 0]} scale={[2.78, 0.18, 0.18]} color={frameColor} />
      </Instances>
      {/* the field faces the trunk, so packets meet it head-on */}
      <mesh position={[0, 0.85, 0]}>
        <planeGeometry args={[2.4, 1.5]} />
        <meshStandardMaterial ref={field} color={MJC.red} emissive={MJC.red} emissiveIntensity={0.4} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={textGroup} visible={false}>
        <Billboard position={[0, 2.2, 0]}>
          <SceneText text="" fontSize={0.26} color={MJC.red} outlineWidth={0.03} textRef={text} />
        </Billboard>
      </group>
    </group>
  );
}
