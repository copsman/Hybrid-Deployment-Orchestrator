"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard, Edges, Instance, Instances, Line, ScreenSizer } from "@react-three/drei";
import { useOrchestrator } from "@/store/orchestrator";
import { useDirector } from "@/store/director";
import type { EnvId, EnvironmentSpec } from "@/engine";
import { CLASS_HEX, ENV_ACCENT, ENV_TONE, MJC, type Tone } from "@/lib/palette";
import { MODULE, PAD, PLAQUE, PLAQUE_LOCAL, QUEUE_LOCAL, SITE, TOWER, moduleLocal, type V3 } from "./layout";
import { geometries, materials } from "./materials";
import { SceneText } from "./SceneText";
import { LABELS, layerAbbr, plaqueText, queueLabel, queueOverflow, siteSubtitle } from "./labels";
import { parseQueueKey, parseVersionKey, selQueueKey, selRunning, selSpec, selVersionKey } from "./selectors";

/** Elastic sites show at most this many spawned pods; the headline carries the true number. */
const POD_LIMIT = 8;
const GATE_LOCAL_Z = 3.1;
const TOWER_TOP = PAD.h + TOWER.h;

/** Static module blocks: the same 5 × 2 grid on every site; the tower (index 2) is drawn separately. */
const MODULE_INDICES = [0, 1, 3, 4, 5, 6, 7, 8, 9];

/* Scratch objects for instance writes: the frame loop is single-threaded, so one set serves every site. */
const DUMMY = new THREE.Object3D();
const TMP_COLOR = new THREE.Color();
const TMP_VEC = new THREE.Vector3();

/** Position of GPU slot i on the tower face (fixed capacity) or pod i on the apron (elastic). */
function slotPosition(slots: number | null, i: number, out: THREE.Vector3): THREE.Vector3 {
  const [tx, , tz] = moduleLocal(TOWER.index);
  if (slots === null) return out.set(-3.1 + i * 0.55, PAD.h + 0.25, 1.5);
  const y0 = PAD.h + (TOWER.h - (slots - 1) * 0.35) / 2;
  return out.set(tx, y0 + i * 0.35, tz + MODULE.size / 2 + 0.06);
}

export function Site({ id }: { id: EnvId }) {
  const spec = useOrchestrator(selSpec[id]);
  const running = useOrchestrator(selRunning[id]);
  const queueKey = useOrchestrator(selQueueKey[id]);
  const versionKey = useOrchestrator(selVersionKey[id]);
  const focus = useDirector((s) => s.focus);
  const focused = focus === id;
  const accent = ENV_ACCENT[id];
  const tone = ENV_TONE[id];
  const busy = running > 0;
  const slots = spec.slots;
  const lit = slots === null ? Math.min(running, POD_LIMIT) : Math.min(running, slots);
  const queue = useMemo(() => parseQueueKey(queueKey), [queueKey]);
  const plaque = useMemo(() => plaqueText(parseVersionKey(versionKey)), [versionKey]);
  const subtitle = siteSubtitle(spec, running, queue.length);

  const g = geometries();
  const m = materials();

  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const cap = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const slotMesh = useRef<THREE.InstancedMesh>(null);
  const queueMesh = useRef<THREE.InstancedMesh>(null);
  const wasBusy = useRef(false);

  const slotLimit = slots ?? POD_LIMIT;
  const slotGeometry = slots === null ? g.pod : g.led;

  /* GPU slots / pods: rewritten only when the running count or the capacity changes. */
  useEffect(() => {
    const mesh = slotMesh.current;
    if (!mesh) return;
    const count = slots === null ? lit : slots;
    for (let i = 0; i < slotLimit; i++) {
      slotPosition(slots, i, TMP_VEC);
      DUMMY.position.copy(TMP_VEC);
      DUMMY.rotation.set(0, 0, 0);
      DUMMY.scale.setScalar(i < count ? 1 : 0.0001);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);
      TMP_COLOR.set(i < lit ? accent : MJC.border);
      mesh.setColorAt(i, TMP_COLOR);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [slots, lit, slotLimit, accent]);

  /* Queue tokens: at most QUEUE_LOCAL.visible, running toward -x, coloured by classification. */
  useEffect(() => {
    const mesh = queueMesh.current;
    if (!mesh) return;
    const count = Math.min(queue.length, QUEUE_LOCAL.visible);
    for (let k = 0; k < QUEUE_LOCAL.visible; k++) {
      DUMMY.position.set(QUEUE_LOCAL.x0 - k * QUEUE_LOCAL.pitch, QUEUE_LOCAL.y, QUEUE_LOCAL.z);
      DUMMY.rotation.set(0, Math.PI / 4, 0);
      DUMMY.scale.setScalar(k < count ? 0.5 : 0.0001);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(k, DUMMY.matrix);
      TMP_COLOR.set(k < count ? CLASS_HEX[queue[k].classification] : MJC.border);
      mesh.setColorAt(k, TMP_COLOR);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [queue]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const l = light.current;
    if (l) {
      const target = busy ? 6 : 2.5;
      if (Math.abs(l.intensity - target) > 0.01) l.intensity = THREE.MathUtils.damp(l.intensity, target, 4, dt);
    }
    const rm = ringMat.current;
    if (rm) {
      const target = busy ? 0.5 : 0.14;
      if (Math.abs(rm.opacity - target) > 0.005) rm.opacity = THREE.MathUtils.damp(rm.opacity, target, 4, dt);
    }
    if (busy) {
      wasBusy.current = true;
      if (ring.current) ring.current.rotation.z += dt * 0.5;
      if (cap.current) cap.current.emissiveIntensity = 0.6 + 0.5 * Math.sin(t * 2);
      const mesh = slotMesh.current;
      if (mesh && lit > 0) {
        for (let i = 0; i < lit; i++) {
          slotPosition(slots, i, TMP_VEC);
          if (slots === null) TMP_VEC.y += 0.04 * Math.sin(t * 3 + i);
          DUMMY.position.copy(TMP_VEC);
          DUMMY.rotation.set(0, 0, 0);
          DUMMY.scale.setScalar(slots === null ? 1 : 1 + 0.15 * Math.sin(t * 4 + i));
          DUMMY.updateMatrix();
          mesh.setMatrixAt(i, DUMMY.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    } else if (wasBusy.current) {
      wasBusy.current = false;
      if (cap.current) cap.current.emissiveIntensity = 0.35;
      const mesh = slotMesh.current;
      if (mesh && slots !== null) {
        for (let i = 0; i < slots; i++) {
          slotPosition(slots, i, TMP_VEC);
          DUMMY.position.copy(TMP_VEC);
          DUMMY.rotation.set(0, 0, 0);
          DUMMY.scale.setScalar(1);
          DUMMY.updateMatrix();
          mesh.setMatrixAt(i, DUMMY.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  const [towerX, towerY, towerZ] = moduleLocal(TOWER.index);
  const hiddenQueue = Math.max(0, queue.length - QUEUE_LOCAL.visible);

  return (
    <group position={SITE[id]}>
      {/* pad */}
      <mesh position={[0, PAD.h / 2, 0]} material={m.pad}>
        <boxGeometry args={[PAD.w, PAD.h, PAD.d]} />
        <Edges color={accent} threshold={15} />
      </mesh>

      {/* nine low modules, the same grid everywhere, outlined in the accent */}
      <Instances limit={MODULE_INDICES.length} frames={1} geometry={g.module} material={m.module}>
        {MODULE_INDICES.map((i) => (
          <Instance key={i} position={moduleLocal(i)} />
        ))}
      </Instances>
      <lineSegments geometry={g.moduleEdges}>
        <lineBasicMaterial color={accent} transparent opacity={0.45} toneMapped={false} />
      </lineSegments>

      {/* model-serving tower with its breathing cap */}
      <mesh position={[towerX, towerY, towerZ]} geometry={g.tower} material={m.body}>
        <Edges color={accent} threshold={15} />
      </mesh>
      <mesh position={[towerX, TOWER_TOP + 0.02, towerZ]}>
        <boxGeometry args={[MODULE.size + 0.02, 0.04, MODULE.size + 0.02]} />
        <meshStandardMaterial ref={cap} color={accent} emissive={accent} emissiveIntensity={0.35} toneMapped={false} />
      </mesh>
      {slots === null && <SceneText text={LABELS.elastic} position={[towerX, PAD.h + 1.2, towerZ + MODULE.size / 2 + 0.01]} fontSize={0.16} color={accent} outlineWidth={0.02} />}

      {/* GPU slot LEDs on the tower face, or elastic pods on the apron: every one is real */}
      <instancedMesh ref={slotMesh} args={[slotGeometry, m.white, slotLimit]} frustumCulled={false} />

      {/* module labels exist only for the focused site */}
      {focused && <ModuleLabels spec={spec} accent={accent} />}

      {/* front gate: routes end under the lintel */}
      <Instances limit={3} frames={1} geometry={g.unitBox} material={m.unlit}>
        <Instance position={[-0.7, 0.5, GATE_LOCAL_Z]} scale={[0.12, 1.0, 0.12]} color={accent} />
        <Instance position={[0.7, 0.5, GATE_LOCAL_Z]} scale={[0.12, 1.0, 0.12]} color={accent} />
        <Instance position={[0, 1.0, GATE_LOCAL_Z]} scale={[1.52, 0.1, 0.12]} color={accent} />
      </Instances>

      {/* queue tokens waiting at the gate */}
      <instancedMesh ref={queueMesh} args={[g.token, m.unlit, QUEUE_LOCAL.visible]} frustumCulled={false} />
      {queue.length > 0 && <SceneText flat text={queueLabel(queue.length)} position={[QUEUE_LOCAL.x0 + 0.15, 0.12, QUEUE_LOCAL.z + 0.45]} anchorX="right" textAlign="right" fontSize={0.14} color={MJC.amber} outlineWidth={0.02} />}
      {hiddenQueue > 0 && <SceneText flat text={queueOverflow(hiddenQueue)} position={[QUEUE_LOCAL.x0 - QUEUE_LOCAL.visible * QUEUE_LOCAL.pitch + 0.1, 0.12, QUEUE_LOCAL.z]} anchorX="right" fontSize={0.16} color={MJC.amber} outlineWidth={0.02} />}

      {/* version plaque */}
      <group position={PLAQUE_LOCAL}>
        <mesh material={m.body}>
          <boxGeometry args={[PLAQUE.w, PLAQUE.h, PLAQUE.d]} />
          <Edges color={plaque.extraTone === "red" ? MJC.red : MJC.green} threshold={15} />
        </mesh>
        <SceneText text={plaque.loaded} position={[0, plaque.extra ? 0.09 : 0, PLAQUE.d / 2 + 0.005]} fontSize={0.14} letterSpacing={0.04} color={MJC.green} outlineWidth={0.015} />
        {plaque.extra && <SceneText text={plaque.extra} position={[0, -0.12, PLAQUE.d / 2 + 0.005]} fontSize={0.11} letterSpacing={0.04} color={plaque.extraTone === "red" ? MJC.red : MJC.amber} outlineWidth={0.015} />}
      </group>

      {/* headline, screen-sized so it reads at every preset */}
      <Billboard position={[0, 3.5, 0]}>
        <ScreenSizer>
          <SceneText screen text={spec.codename} fontSize={12} letterSpacing={0.25} color={focused ? accent : MJC.fg} />
          <SceneText screen text={subtitle} fontSize={8.5} letterSpacing={0.08} lineHeight={1.35} color={MJC.mutedFg} anchorY="top" position={[0, -8, 0]} />
        </ScreenSizer>
      </Billboard>

      {/* busy halo: spins only while jobs run */}
      <mesh ref={ring} geometry={g.ring} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial ref={ringMat} color={accent} transparent opacity={0.14} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>

      <pointLight ref={light} position={[0, 3.4, 0.5]} color={accent} intensity={2.5} distance={13} />

      <Enclosure kind={spec.kind} accent={accent} tone={tone} />
    </group>
  );
}

function ModuleLabels({ spec, accent }: { spec: EnvironmentSpec; accent: string }) {
  return (
    <group>
      {spec.stack.slice(0, 10).map((component, i) => {
        const [x, , z] = moduleLocal(i);
        const top = i === TOWER.index ? TOWER_TOP + 0.06 : PAD.h + MODULE.h + 0.02;
        return (
          <group key={component.layer} position={[x, top, z]}>
            <SceneText flat text={layerAbbr(component.layer)} position={[0, 0, -0.17]} fontSize={0.15} color={accent} outlineWidth={0.015} />
            <SceneText flat text={component.name} position={[0, 0, 0.16]} fontSize={0.09} letterSpacing={0.02} lineHeight={1.15} maxWidth={0.94} color={MJC.mutedFg} outlineWidth={0.012} />
          </group>
        );
      })}
    </group>
  );
}

const KERB: V3[] = [
  [-3.9, 0.2, -2.9],
  [3.9, 0.2, -2.9],
  [3.9, 0.2, 2.9],
  [-3.9, 0.2, 2.9],
  [-3.9, 0.2, -2.9],
];

/** Dashed fence with a gap for the gate; starts and ends beside the gate posts. */
const FENCE: V3[] = [
  [-0.95, 0.55, 3.0],
  [-4.0, 0.55, 3.0],
  [-4.0, 0.55, -3.0],
  [4.0, 0.55, -3.0],
  [4.0, 0.55, 3.0],
  [0.95, 0.55, 3.0],
];

const FENCE_POSTS: [number, number][] = [
  [-4, -3],
  [-2, -3],
  [0, -3],
  [2, -3],
  [4, -3],
  [-4, 3],
  [-2, 3],
  [2, 3],
  [4, 3],
  [-4, -1],
  [-4, 1],
  [4, -1],
  [4, 1],
];

/** Bunker walls: back, two sides, two front halves leaving the door gap, four pillars. */
const BUNKER: { position: V3; scale: V3 }[] = [
  { position: [0, 0.51, -2.85], scale: [7.8, 0.7, 0.25] },
  { position: [-3.9, 0.51, 0], scale: [0.25, 0.7, 5.95] },
  { position: [3.9, 0.51, 0], scale: [0.25, 0.7, 5.95] },
  { position: [-2.25, 0.51, 2.85], scale: [3.3, 0.7, 0.25] },
  { position: [2.25, 0.51, 2.85], scale: [3.3, 0.7, 0.25] },
  { position: [-3.7, 1.175, -2.7], scale: [0.2, 2.35, 0.2] },
  { position: [3.7, 1.175, -2.7], scale: [0.2, 2.35, 0.2] },
  { position: [-3.7, 1.175, 2.7], scale: [0.2, 2.35, 0.2] },
  { position: [3.7, 1.175, 2.7], scale: [0.2, 2.35, 0.2] },
];

/** What differs between perimeters: the enclosure and the network-posture prop. */
function Enclosure({ kind, accent, tone }: { kind: EnvironmentSpec["kind"]; accent: string; tone: Tone }) {
  const g = geometries();
  const m = materials();
  const dimAccent = useMemo(() => "#" + new THREE.Color(accent).multiplyScalar(0.8).getHexString(), [accent]);
  const pulse = useRef<THREE.Mesh>(null);
  const pulseMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state) => {
    if (kind !== "cloud") return;
    const ring = pulse.current;
    const mat = pulseMat.current;
    if (!ring || !mat) return;
    const k = (state.clock.elapsedTime * 0.5) % 1;
    ring.scale.setScalar(1 + k);
    mat.opacity = 0.6 * (1 - k);
  });

  if (kind === "cloud") {
    return (
      <group>
        <Line points={KERB} color={accent} transparent opacity={0.35} lineWidth={1} />
        {/* uplink mast: always pulsing, the sign of an external network */}
        <group position={[3.3, 0, -2.4]}>
          <mesh position={[0, 1.56, 0]} material={m.body}>
            <cylinderGeometry args={[0.04, 0.04, 2.8, 8]} />
          </mesh>
          <mesh position={[0, 2.96, 0]} material={m.accent[tone]}>
            <sphereGeometry args={[0.12, 12, 12]} />
          </mesh>
          <mesh ref={pulse} position={[0, 3.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.02, 6, 32]} />
            <meshBasicMaterial ref={pulseMat} color={accent} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      </group>
    );
  }

  if (kind === "onprem") {
    return (
      <group>
        <Line points={FENCE} color={accent} transparent opacity={0.6} lineWidth={1.2} dashed dashSize={0.3} gapSize={0.2} />
        <Instances limit={FENCE_POSTS.length} frames={1} geometry={g.unitBox} material={m.unlit}>
          {FENCE_POSTS.map(([x, z]) => (
            <Instance key={`${x}:${z}`} position={[x, 0.35, z]} scale={[0.06, 0.7, 0.06]} color={dimAccent} />
          ))}
        </Instances>
      </group>
    );
  }

  return (
    <group>
      <Instances limit={BUNKER.length} frames={1} geometry={g.unitBox} material={m.wall}>
        {BUNKER.map((b, i) => (
          <Instance key={i} position={b.position} scale={b.scale} />
        ))}
      </Instances>
      {/* glass canopy: the campus reads through the tint */}
      <mesh position={[0, 2.35, 0]} material={m.glass} renderOrder={2}>
        <boxGeometry args={[7.8, 0.06, 5.8]} />
        <Edges color={accent} threshold={15} />
      </mesh>
      {/* stub mast with a crossed bar: no link */}
      <group position={[3.3, 0, -2.4]}>
        <mesh position={[0, 0.66, 0]} material={m.body}>
          <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
        </mesh>
        <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 4]} material={m.accent[tone]}>
          <boxGeometry args={[0.7, 0.06, 0.06]} />
        </mesh>
        <mesh position={[0, 1.4, 0]} rotation={[0, 0, -Math.PI / 4]} material={m.accent[tone]}>
          <boxGeometry args={[0.7, 0.06, 0.06]} />
        </mesh>
      </group>
    </group>
  );
}
