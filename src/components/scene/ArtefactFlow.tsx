"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import type { ArtefactState } from "@/engine";
import { useOrchestrator } from "@/store/orchestrator";
import { MJC } from "@/lib/palette";
import { CHANNEL, PROXY_X, STOPS, type V3 } from "./layout";
import { geometries } from "./materials";
import { SceneText, type SceneTextHandle } from "./SceneText";
import { bundleRejected, bundleTag } from "./labels";
import { parseImportKey, selImportKey, selResetSeq } from "./selectors";

const FLIGHT_SECONDS = 1.4;
const FADE_AFTER_LOAD = 1.5;
const TMP = new THREE.Vector3();

type Stop = keyof typeof STOPS;
type Flight = keyof typeof CHANNEL;

/** Where the signed bundle rests for each pipeline state; null while the chunks stand in for it. */
function restingStop(state: ArtefactState | null): Stop | null {
  switch (state) {
    case "BUILT":
    case "SIGNED":
      return "bench";
    case "PUBLISHED":
      return "cloudRegistry";
    case "MIRRORED":
      return "onpremRegistry";
    case "STAGED":
      return "outbox";
    case "IMPORTED":
    case "LOADED":
      return "enclaveRegistry";
    case "REJECTED":
      return "quarantine";
    default:
      return null;
  }
}

/** Which channel leg a state transition rides, if it is animated at all. */
function flightFor(from: ArtefactState | null, to: ArtefactState | null): Flight | null {
  if (to === "PUBLISHED" && (from === "SIGNED" || from === "BUILT")) return "publish";
  if (to === "MIRRORED" && from === "PUBLISHED") return "mirror";
  if (to === "STAGED" && from === "MIRRORED") return "stage";
  if (to === "IMPORTED" && from === "VERIFYING") return "import";
  return null;
}

function easeInOut(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/**
 * The signed bundle as one token that moves along the artefact channel on every state
 * transition: bench → cloud registry (publish) → through the inspection proxy to the
 * on-prem registry (mirror) → the low-side outbox (stage) → hidden while the chunks
 * cross the diode → the enclave registry (import), fading once it is LOADED. REJECTED
 * leaves it shaking red at the quarantine tray. On mount and after a reset it snaps to
 * its resting stop without a flight. It also owns the proxy scan plane, which brightens
 * while the mirror flight is within a unit of the checkpoint; nothing else reads it.
 */
export function ArtefactFlow() {
  const importKey = useOrchestrator(selImportKey);
  const resetSeq = useOrchestrator(selResetSeq);
  const info = useMemo(() => parseImportKey(importKey), [importKey]);
  const g = geometries();

  const group = useRef<THREE.Group>(null);
  const token = useRef<THREE.Mesh>(null);
  const tokenMat = useRef<THREE.MeshStandardMaterial>(null);
  const label = useRef<SceneTextHandle>(null);
  const scanMat = useRef<THREE.MeshBasicMaterial>(null);

  const flight = useRef<{ curve: THREE.Curve<THREE.Vector3>; t0: number; leg: Flight } | null>(null);
  const restAt = useRef<Stop | null>(null);
  const lastState = useRef<ArtefactState | null>(null);
  const lastVersion = useRef<string>("");
  const lastReset = useRef(resetSeq);
  const loadedAt = useRef(-1);
  const clock = useRef(0);
  const pending = useRef(true);

  /* State transitions: decide the flight (or snap) here, apply it in the frame loop. */
  useEffect(() => {
    const state = info.state;
    const snapped = resetSeq !== lastReset.current || info.version !== lastVersion.current;
    lastReset.current = resetSeq;
    lastVersion.current = info.version;
    const leg = snapped ? null : flightFor(lastState.current, state);
    lastState.current = state;
    restAt.current = restingStop(state);
    if (leg) flight.current = { curve: CHANNEL[leg], t0: clock.current, leg };
    else flight.current = null;
    loadedAt.current = state === "LOADED" ? clock.current : -1;
    pending.current = true;
  }, [info, resetSeq]);

  const rejected = info.state === "REJECTED";

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    clock.current = t;
    const grp = group.current;
    const mesh = token.current;
    const mat = tokenMat.current;
    const scan = scanMat.current;
    if (!grp || !mesh || !mat) return;

    const f = flight.current;
    let proxyGlow = 0.12;
    if (f) {
      const u = Math.min(1, (t - f.t0) / FLIGHT_SECONDS);
      f.curve.getPoint(easeInOut(u), TMP);
      grp.position.copy(TMP);
      grp.visible = true;
      if (f.leg === "mirror") {
        const d = Math.abs(TMP.x - PROXY_X);
        if (d < 1) proxyGlow = 0.12 + (1 - d) * 0.45;
      }
      if (u >= 1) flight.current = null;
      pending.current = false;
    } else if (pending.current) {
      pending.current = false;
      const stop = restAt.current;
      if (stop) {
        const p: V3 = STOPS[stop];
        grp.position.set(p[0], p[1], p[2]);
        grp.visible = true;
      } else {
        grp.visible = false;
      }
      mat.opacity = 1;
      if (label.current) label.current.fillOpacity = 1;
    }
    if (scan && Math.abs(scan.opacity - proxyGlow) > 0.002) scan.opacity = THREE.MathUtils.damp(scan.opacity, proxyGlow, 8, dt);

    if (!grp.visible) return;
    mesh.rotation.y += dt * 0.9;
    if (rejected) {
      mesh.position.x = Math.sin(t * 40) * 0.02;
    } else if (mesh.position.x !== 0) {
      mesh.position.x = 0;
    }
    if (loadedAt.current >= 0 && !flight.current) {
      const k = Math.min(1, Math.max(0, (t - loadedAt.current - FADE_AFTER_LOAD) / 0.8));
      mat.opacity = 1 - k;
      if (label.current) label.current.fillOpacity = 1 - k;
      if (k >= 1) grp.visible = false;
    }
  });

  return (
    <group>
      {/* visibility and position are owned by the frame loop; the first frame snaps to the resting stop */}
      <group ref={group} visible={false}>
        <mesh ref={token} geometry={g.token} rotation={[0.4, 0.6, 0]}>
          <meshStandardMaterial ref={tokenMat} color={rejected ? MJC.red : MJC.amber} emissive={rejected ? MJC.red : MJC.amber} emissiveIntensity={1.6} transparent opacity={1} toneMapped={false} />
        </mesh>
        <Billboard position={[0, 0.42, 0]}>
          <SceneText text={rejected ? bundleRejected(info.version) : bundleTag(info.version)} fontSize={0.16} color={rejected ? MJC.red : MJC.amber} outlineWidth={0.03} textRef={label} />
        </Billboard>
      </group>
      {/* proxy scan plane on the cloud | on-prem boundary, lit by the mirror flight */}
      <mesh position={[PROXY_X, 0.8, -1.9]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.3, 1.3]} />
        <meshBasicMaterial ref={scanMat} color={MJC.amber} transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
