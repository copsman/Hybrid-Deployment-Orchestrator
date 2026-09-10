"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Edges, Instance, Instances, ScreenSizer } from "@react-three/drei";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import { MJC } from "@/lib/palette";
import { CHUNKS_MAX, CONSOLES, GATE, GATE_R, OUTBOX, QUARANTINE, TRAY, WALL_X, chunkSlot, type V3 } from "./layout";
import { geometries, materials } from "./materials";
import { SceneText } from "./SceneText";
import { LABELS, consoleLabel, diodeCounter, stagedCounter, type ConsoleStatus } from "./labels";
import { parseImportKey, selImportKey, selPlaying, selStepId } from "./selectors";

const FLIGHT_SECONDS = 0.45;
const STAGGER_SECONDS = 0.08;
const SCAN_AFTER_SECONDS = 1.5;
const BOUNCE_APPROACH = 0.8;
const BOUNCE_RECOIL = 0.7;
const PARK_OUTBOX = 0;
const PARK_QUARANTINE = 1;
const PARK_HIDDEN = 2;

const DUMMY = new THREE.Object3D();
const TMP = new THREE.Vector3();
const APEX = new THREE.Vector3(WALL_X, 1.5, GATE[2]);

/** Per-chunk conveyor state; typed arrays so the frame loop never allocates. */
interface Conveyor {
  /** 0 outbox, 1 quarantine, 2 hidden */
  parked: Uint8Array;
  /** clock time a chunk leaves the outbox, or -1 when it is not flying */
  departAt: Float32Array;
  dirty: boolean;
  flying: boolean;
  lastSent: number;
  lastVersion: string | null;
  seenBounces: number;
}

function createConveyor(): Conveyor {
  return { parked: new Uint8Array(CHUNKS_MAX).fill(PARK_HIDDEN), departAt: new Float32Array(CHUNKS_MAX).fill(-1), dirty: true, flying: false, lastSent: 0, lastVersion: null, seenBounces: 0 };
}

/** Quadratic arc from an outbox slot over the gate apex into the matching quarantine slot, written into `out`. */
function chunkFlightPoint(i: number, u: number, out: THREE.Vector3): THREE.Vector3 {
  const a = chunkSlot(OUTBOX, i);
  const b = chunkSlot(QUARANTINE, i);
  const k = 1 - u;
  out.x = k * k * a[0] + 2 * k * u * APEX.x + u * u * b[0];
  out.y = k * k * a[1] + 2 * k * u * APEX.y + u * u * b[1];
  out.z = k * k * a[2] + 2 * k * u * APEX.z + u * u * b[2];
  return out;
}

function writeParked(mesh: THREE.InstancedMesh, i: number, park: number) {
  if (park === PARK_HIDDEN) {
    DUMMY.position.set(0, -10, 0);
    DUMMY.scale.setScalar(0.0001);
  } else {
    const slot = chunkSlot(park === PARK_OUTBOX ? OUTBOX : QUARANTINE, i);
    DUMMY.position.set(slot[0], slot[1], slot[2]);
    DUMMY.scale.setScalar(1);
  }
  DUMMY.rotation.set(0, 0, 0);
  DUMMY.updateMatrix();
  mesh.setMatrixAt(i, DUMMY.matrix);
}

function easeInOut(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/**
 * The data diode: gate ring and cone in the wall doorway, a low-side outbox tray and a
 * high-side quarantine tray, and a conveyor of up to 32 chunk instances whose parking
 * follows the engine's sent/total exactly (each newly sent chunk flies over the gate
 * once). The chunks stack in the outbox as soon as the bundle is STAGED, hide when
 * there is no transfer and once the version is IMPORTED/LOADED (the bundle has been
 * reassembled). The return-path bounce fires on every new blocked attempt; its counter
 * resets when the transfer clears or changes version, so a replay after reset bounces
 * again. The scanner sweep and the two operator consoles animate the import ceremony.
 */
export function DiodeGate() {
  const diode = useOrchestrator((s) => s.diode);
  const importKey = useOrchestrator(selImportKey);
  const focus = useDirector((s) => s.focus);
  const stepId = useDirector(selStepId);
  const playing = useDirector(selPlaying);
  const imported = useMemo(() => parseImportKey(importKey), [importKey]);
  const g = geometries();
  const m = materials();

  const active = !!diode?.active;
  const total = diode ? Math.min(diode.total, CHUNKS_MAX) : CHUNKS_MAX;
  const sent = diode ? Math.min(diode.sent, total) : 0;
  /** bundle staged in the outbox, first chunk not yet sent: the engine emits no diode signal until then */
  const stagedOnly = diode === null && imported.state === "STAGED";
  const version = diode?.version ?? (stagedOnly ? imported.version : null);
  const reassembled = version !== null && imported.version === version && (imported.state === "IMPORTED" || imported.state === "LOADED");
  const ceremony = imported.state === "QUARANTINE" || imported.state === "VERIFYING" || imported.state === "IMPORTED";
  const scanning = stepId === "scan" && playing;

  const chunks = useRef<THREE.InstancedMesh>(null);
  const gateMat = useRef<THREE.MeshStandardMaterial>(null);
  const apertureMat = useRef<THREE.MeshBasicMaterial>(null);
  const bounce = useRef<THREE.Mesh>(null);
  const scanner = useRef<THREE.Mesh>(null);
  const screens = useRef<(THREE.MeshStandardMaterial | null)[]>([null, null]);
  const conveyor = useRef<Conveyor | null>(null);
  if (conveyor.current === null) conveyor.current = createConveyor();
  const bounceT = useRef(-1);
  const scanUntil = useRef(-1);
  const wasScanned = useRef(imported.scanned);
  const screenSpike = useRef<[number, number]>([0, 0]);
  const lastApprovals = useRef(imported.approvals);
  const clock = useRef(0);

  /* Transfer state machine: runs on every diode / import change, never per frame. */
  useEffect(() => {
    const c = conveyor.current;
    if (!c) return;
    if (version !== c.lastVersion) {
      c.lastVersion = version;
      c.lastSent = 0;
      c.seenBounces = 0;
      c.departAt.fill(-1);
      c.parked.fill(version === null ? PARK_HIDDEN : PARK_OUTBOX);
      c.dirty = true;
      bounceT.current = -1;
    }
    if (version !== null && !reassembled) {
      if (sent < c.lastSent) {
        // the same version replayed after a reset: everything back to the outbox
        c.parked.fill(PARK_OUTBOX);
        c.departAt.fill(-1);
        c.lastSent = 0;
        c.dirty = true;
      }
      if (sent > c.lastSent) {
        for (let i = c.lastSent; i < sent; i++) {
          c.parked[i] = PARK_OUTBOX;
          c.departAt[i] = clock.current + (i - c.lastSent) * STAGGER_SECONDS;
        }
        c.lastSent = sent;
        c.dirty = true;
        c.flying = true;
      }
      for (let i = total; i < CHUNKS_MAX; i++) c.parked[i] = PARK_HIDDEN;
    }
    if (reassembled && c.parked[0] !== PARK_HIDDEN) {
      c.parked.fill(PARK_HIDDEN);
      c.departAt.fill(-1);
      c.dirty = true;
    }
    if (diode !== null && diode.bounces > c.seenBounces) {
      c.seenBounces = diode.bounces;
      bounceT.current = 0;
    }
  }, [diode, version, sent, total, reassembled]);

  /* Manual scan and approvals (PIPELINE tab or director): sweep briefly, spike the screen. */
  useEffect(() => {
    if (imported.scanned && !wasScanned.current) scanUntil.current = clock.current + SCAN_AFTER_SECONDS;
    wasScanned.current = imported.scanned;
    if (imported.approvals > lastApprovals.current) {
      for (let k = lastApprovals.current; k < imported.approvals && k < 2; k++) screenSpike.current[k] = 1;
    }
    lastApprovals.current = imported.approvals;
  }, [imported.scanned, imported.approvals]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    clock.current = t;

    const mesh = chunks.current;
    const c = conveyor.current;
    if (mesh && c && (c.dirty || c.flying)) {
      let anyFlying = false;
      for (let i = 0; i < CHUNKS_MAX; i++) {
        const d = c.departAt[i];
        if (d >= 0) {
          const u = (t - d) / FLIGHT_SECONDS;
          if (u >= 1) {
            c.departAt[i] = -1;
            c.parked[i] = PARK_QUARANTINE;
            writeParked(mesh, i, PARK_QUARANTINE);
          } else if (u > 0) {
            chunkFlightPoint(i, easeInOut(u), TMP);
            DUMMY.position.copy(TMP);
            DUMMY.rotation.set(0, 0, 0);
            DUMMY.scale.setScalar(1);
            DUMMY.updateMatrix();
            mesh.setMatrixAt(i, DUMMY.matrix);
            anyFlying = true;
          } else {
            anyFlying = true;
            if (c.dirty) writeParked(mesh, i, c.parked[i]);
          }
        } else if (c.dirty) {
          writeParked(mesh, i, c.parked[i]);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      c.dirty = false;
      c.flying = anyFlying;
    }

    if (gateMat.current) gateMat.current.emissiveIntensity = active ? 2.4 + 0.6 * Math.sin(t * 8) : 1;
    if (apertureMat.current) apertureMat.current.opacity = active ? 0.22 : 0.08;

    const b = bounce.current;
    if (b) {
      if (bounceT.current >= 0) {
        bounceT.current += dt;
        const tt = bounceT.current;
        let x: number;
        let y = GATE[1];
        let s = 0.16;
        if (tt <= BOUNCE_APPROACH) {
          x = 7.0 - (tt / BOUNCE_APPROACH) * (7.0 - (WALL_X + 0.25));
        } else {
          const k = Math.min(1, (tt - BOUNCE_APPROACH) / BOUNCE_RECOIL);
          x = WALL_X + 0.25 + k * 1.45;
          y = GATE[1] + Math.sin(k * Math.PI) * 0.6 - k * 0.7;
          s = 0.16 * (1 - k);
        }
        b.position.set(x, y, GATE[2]);
        b.scale.setScalar(Math.max(0.0001, s));
        b.visible = true;
        if (tt > BOUNCE_APPROACH + BOUNCE_RECOIL) bounceT.current = -1;
      } else if (b.visible) {
        b.visible = false;
      }
    }

    const sc = scanner.current;
    if (sc) {
      const on = scanning || t < scanUntil.current;
      sc.visible = on;
      if (on) sc.position.x = QUARANTINE[0] + Math.sin((t * Math.PI * 2) / 1.2) * 0.6;
    }

    for (let k = 0; k < 2; k++) {
      const mat = screens.current[k];
      if (!mat) continue;
      const spike = screenSpike.current[k];
      if (spike > 0) {
        screenSpike.current[k] = Math.max(0, spike - dt / 0.6);
        mat.emissiveIntensity = 1.6 + spike * 2.5;
      }
    }
  });

  const showConsoleLabels = focus === "airgapped" || ceremony;
  const showTrayLabels = focus === "diode" || focus === "onprem" || focus === "airgapped";
  const headlineHot = focus === "diode" || active;
  const counter = diode ? diodeCounter(diode) : stagedOnly ? stagedCounter(CHUNKS_MAX) : diodeCounter(null);

  return (
    <group>
      {/* gate hardware in the doorway */}
      <mesh position={GATE} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[GATE_R, 0.05, 10, 48]} />
        <meshStandardMaterial ref={gateMat} color={MJC.cyan} emissive={MJC.cyan} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      <mesh position={[GATE[0] + 0.25, GATE[1], GATE[2]]} rotation={[0, 0, -Math.PI / 2]} material={m.accent.cyan}>
        <coneGeometry args={[0.26, 0.55, 12]} />
      </mesh>
      <mesh position={GATE} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[GATE_R - 0.05, 32]} />
        <meshBasicMaterial ref={apertureMat} color={MJC.cyan} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* trays */}
      <Tray at={OUTBOX} tone={MJC.amber} label={LABELS.outbox} showLabel={showTrayLabels} />
      <Tray at={QUARANTINE} tone={MJC.red} label={LABELS.quarantine} showLabel={showTrayLabels} />

      {/* the conveyor: one instance per chunk, parked or in flight */}
      <instancedMesh ref={chunks} args={[undefined, undefined, CHUNKS_MAX]} geometry={g.chunk} material={m.accent.amber} frustumCulled={false} />

      {/* a return-path attempt from the high side: approaches the gate, hits it, drops */}
      <mesh ref={bounce} visible={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial color={MJC.red} emissive={MJC.red} emissiveIntensity={3} toneMapped={false} />
      </mesh>

      {/* quarantine scanner sweep */}
      <mesh ref={scanner} position={[QUARANTINE[0], QUARANTINE[1] + 0.3, QUARANTINE[2]]} material={m.glow.cyan} visible={false}>
        <boxGeometry args={[0.02, 0.28, TRAY.d]} />
      </mesh>

      {/* two operator consoles: the two-person rule made visible */}
      <Instances limit={CONSOLES.length} frames={1} geometry={g.unitBox} material={m.body}>
        {CONSOLES.map((at, k) => (
          <Instance key={k} position={[at[0], 0.35, at[2]]} scale={[0.36, 0.7, 0.36]} />
        ))}
      </Instances>
      {CONSOLES.map((at, k) => {
        // approvals count only during the newest bundle's ceremony; the baseline version's
        // historical approvals must not light the screens at boot
        const status: ConsoleStatus = !ceremony ? "standby" : imported.approvals > k ? "approved" : "awaiting";
        const tone = status === "approved" ? MJC.green : status === "awaiting" ? MJC.amber : MJC.mutedFg;
        return (
          <group key={k} position={at}>
            <mesh position={[0, 0.9, 0.05]} rotation={[-0.45, 0, 0]}>
              <boxGeometry args={[0.5, 0.34, 0.05]} />
              <meshStandardMaterial
                ref={(mat) => {
                  screens.current[k] = mat;
                }}
                color={status === "standby" ? MJC.border : tone}
                emissive={status === "standby" ? "#000000" : tone}
                emissiveIntensity={status === "approved" ? 1.6 : status === "awaiting" ? 0.5 : 0}
                toneMapped={false}
              />
            </mesh>
            {showConsoleLabels && <SceneText text={consoleLabel(imported.operators[k], k, status)} position={[0, 1.4, 0]} fontSize={0.12} lineHeight={1.3} color={tone} outlineWidth={0.02} />}
          </group>
        );
      })}

      {/* headline */}
      <Billboard position={[WALL_X, 3.1, GATE[2]]}>
        <ScreenSizer>
          <SceneText screen text={LABELS.diode} fontSize={12} letterSpacing={0.25} color={headlineHot ? MJC.cyan : MJC.fg} />
          <SceneText screen text={counter} fontSize={8.5} letterSpacing={0.08} color={active || stagedOnly ? MJC.amber : MJC.mutedFg} anchorY="top" position={[0, -8, 0]} />
        </ScreenSizer>
      </Billboard>
    </group>
  );
}

function Tray({ at, tone, label, showLabel }: { at: V3; tone: string; label: string; showLabel: boolean }) {
  const m = materials();
  return (
    <group position={at}>
      <mesh material={m.body}>
        <boxGeometry args={[TRAY.w, TRAY.h, TRAY.d]} />
        <Edges color={tone} threshold={15} />
      </mesh>
      {showLabel && <SceneText flat text={label} position={[0, TRAY.h / 2 + 0.01, TRAY.d / 2 + 0.16]} fontSize={0.11} color={tone} />}
    </group>
  );
}
