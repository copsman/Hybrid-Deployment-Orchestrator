"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, ScreenSizer } from "@react-three/drei";
import { useOrchestrator } from "@/store/orchestrator";
import { MJC } from "@/lib/palette";
import { OBELISK } from "./layout";
import { geometries, materials } from "./materials";
import { SceneText } from "./SceneText";
import { ledgerHeadline } from "./labels";
import { selLedgerHead, selLedgerLen, selLedgerOk, selResetSeq } from "./selectors";

const LINKS = 24;
const PULSE_SECONDS = 0.8;
const DUMMY = new THREE.Object3D();

/**
 * The hash-chained ledger as an obelisk: one link ring per entry (up to 24), green while
 * the chain verifies and red once tampered, a pulse rising the spire on every append.
 * The pulse keys on the ledger length, which covers all fifteen append sites in the
 * engine, and is suppressed across a reset so the boot ledger never fires it.
 */
export function Ledger() {
  const len = useOrchestrator(selLedgerLen);
  const ok = useOrchestrator(selLedgerOk);
  const head = useOrchestrator(selLedgerHead);
  const resetSeq = useOrchestrator(selResetSeq);
  const g = geometries();
  const m = materials();
  const links = useRef<THREE.InstancedMesh>(null);
  const spire = useRef<THREE.MeshStandardMaterial>(null);
  const pulseRing = useRef<THREE.Mesh>(null);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null);
  const pulse = useRef(0);
  const lastLen = useRef(len);
  const lastReset = useRef(resetSeq);
  const tone = ok ? MJC.green : MJC.red;

  useEffect(() => {
    const mesh = links.current;
    if (!mesh) return;
    const n = Math.min(len, LINKS);
    for (let i = 0; i < LINKS; i++) {
      DUMMY.position.set(0, 0.3 + i * 0.115, 0);
      DUMMY.rotation.set(Math.PI / 2, 0, 0);
      DUMMY.scale.setScalar(i < n ? 1 - i * 0.02 : 0.0001);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }, [len]);

  useFrame((_, dt) => {
    if (resetSeq !== lastReset.current) {
      lastReset.current = resetSeq;
      lastLen.current = len;
      pulse.current = 0;
    } else if (len > lastLen.current) {
      lastLen.current = len;
      pulse.current = 1;
    } else if (len < lastLen.current) {
      lastLen.current = len;
    }
    const ring = pulseRing.current;
    const ringMat = pulseMat.current;
    const spireMat = spire.current;
    if (!ring || !ringMat || !spireMat) return;
    if (pulse.current <= 0) {
      if (ring.visible) {
        ring.visible = false;
        spireMat.emissiveIntensity = 0.3;
      }
      return;
    }
    pulse.current = Math.max(0, pulse.current - dt / PULSE_SECONDS);
    const k = 1 - pulse.current;
    ring.visible = true;
    ring.position.y = 0.3 + k * 2.9;
    ringMat.opacity = 0.6 * pulse.current;
    spireMat.emissiveIntensity = 0.3 + pulse.current * 2.2;
  });

  return (
    <group position={OBELISK}>
      <mesh position={[0, 0.05, 0]} material={m.pad}>
        <cylinderGeometry args={[0.6, 0.7, 0.1, 6]} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.12, 0.32, 3.0, 4]} />
        <meshStandardMaterial ref={spire} color="#0d1420" metalness={0.7} roughness={0.3} emissive={tone} emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
      <instancedMesh ref={links} args={[undefined, undefined, LINKS]} geometry={g.link} material={m.accent[ok ? "green" : "red"]} frustumCulled={false} />
      <mesh ref={pulseRing} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.45, 0.02, 6, 48]} />
        <meshBasicMaterial ref={pulseMat} color={MJC.green} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <Billboard position={[0, 4.6, 0]}>
        <ScreenSizer>
          <SceneText screen text={ledgerHeadline(len, head, ok)} fontSize={8.5} letterSpacing={0.08} lineHeight={1.35} color={tone} />
        </ScreenSizer>
      </Billboard>
    </group>
  );
}
