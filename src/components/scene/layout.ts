/**
 * World layout of the control-room scene: a left-to-right trust gradient.
 *
 *   x → right (trust increases)     y → up     z → toward the camera
 *
 *   PERIMETER 01 CLOUD | proxy | PERIMETER 02 SOVEREIGN | diode wall | PERIMETER 03 ENCLAVE
 *   ------------------------------ policy plane (front strip) ------------------------------
 *
 * Three identical zone plates carry three identical campuses; the policy router sits on
 * the front strip and every route leaves it through one barrier arch before fanning out.
 * The air-gapped route is the only geometry that crosses the wall, and it does so through
 * the diode gate. `tests/scene/layout.test.ts` asserts these invariants.
 */
import * as THREE from "three";
import type { EnvId } from "@/engine";
import type { Focus } from "@/engine/scenario";

export type V3 = [number, number, number];

/* ------------------------------------------------------------------ zones (three identical plates) */
export const ZONE_HALF_W = 4.8; // plate 9.6 wide
export const ZONE_Z0 = -6.5;
export const ZONE_Z1 = 3.5; // plate 10 deep, centre z = -1.5
export const ZONE_CX: Record<EnvId, number> = { cloud: -10.5, onprem: 0, airgapped: 10.5 };
export const ZONE_ORDER: EnvId[] = ["cloud", "onprem", "airgapped"];
/** inspection-proxy checkpoint, in the gap between cloud and on-prem */
export const PROXY_X = -5.25;
/** data-diode wall, in the gap between on-prem and the enclave */
export const WALL_X = 5.25;
export const WALL = { thickness: 0.3, height: 2.2, z0: ZONE_Z0 - 0.2, z1: ZONE_Z1 + 0.2 } as const;

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export function zoneRect(id: EnvId): Rect {
  return { x0: ZONE_CX[id] - ZONE_HALF_W, x1: ZONE_CX[id] + ZONE_HALF_W, z0: ZONE_Z0, z1: ZONE_Z1 };
}

/* ------------------------------------------------------------------ policy plane (front strip) */
export const STRIP_HALF_W = 13;
export const STRIP_Z0 = 5.0;
export const STRIP_Z1 = 9.6;
export const STRIP_RECT: Rect = { x0: -STRIP_HALF_W, x1: STRIP_HALF_W, z0: STRIP_Z0, z1: STRIP_Z1 };
export const HUB: V3 = [0, 0, 7.3];
/** policy barrier arch: the single exit from the policy plane, in the corridor z 3.5 … 5.0 */
export const ARCH: V3 = [0, 0, 4.25];
export const BENCH: V3 = [-3.4, 0, 8.0];
export const OBELISK: V3 = [3.4, 0, 8.0];

/* ------------------------------------------------------------------ campuses (same footprint everywhere) */
export const SITE: Record<EnvId, V3> = {
  cloud: [ZONE_CX.cloud, 0, -1.7],
  onprem: [ZONE_CX.onprem, 0, -1.7],
  airgapped: [ZONE_CX.airgapped, 0, -1.7],
};
export const PAD = { w: 7.6, h: 0.16, d: 5.6 } as const; // local x ±3.8, z ±2.8 (world z -4.5 … 1.1)
export const MODULE = { size: 1.0, h: 0.6, pitch: 1.3, cols: 5, rowZ: [-1.5, -0.2] as const } as const;
/** stack index of "Model serving": the tower carrying the GPU LEDs */
export const TOWER = { index: 2, h: 1.9 } as const;
export const RING_R = 4.2;
/** world z of the front gate, the queue row and the version plaque */
export const GATE_Z = 1.4;
export const QUEUE_Z = 2.2;
export const PLAQUE_Z = 1.5;
/** local x of the plaque centre and the queue row (runs toward -x, away from the outbox) */
export const PLAQUE_LOCAL: V3 = [-2.4, 0.42, PLAQUE_Z - SITE.onprem[2]];
export const PLAQUE = { w: 2.1, h: 0.5, d: 0.06 } as const;
export const QUEUE_LOCAL = { x0: -0.7, pitch: 0.45, z: QUEUE_Z - SITE.onprem[2], y: 0.2, visible: 5 } as const;

/** Centre of stack module i (0 … 9) in site-local coordinates; the tower (i = 2) is taller. */
export function moduleLocal(i: number): V3 {
  const col = i % MODULE.cols;
  const row = (i / MODULE.cols) | 0;
  const h = i === TOWER.index ? TOWER.h : MODULE.h;
  return [-2.6 + col * MODULE.pitch, PAD.h + h / 2, MODULE.rowZ[row] ?? MODULE.rowZ[1]];
}

export function siteGate(id: EnvId): V3 {
  return [ZONE_CX[id], 0.6, GATE_Z];
}

export function queueSlot(id: EnvId, k: number): V3 {
  return [ZONE_CX[id] + QUEUE_LOCAL.x0 - k * QUEUE_LOCAL.pitch, QUEUE_LOCAL.y, QUEUE_Z];
}

/* ------------------------------------------------------------------ diode assembly */
export const GATE: V3 = [WALL_X, 0.9, 2.4];
export const GATE_R = 0.65;
export const OUTBOX: V3 = [3.6, 0.12, 2.4]; // low-side tray on the on-prem apron
export const QUARANTINE: V3 = [7.2, 0.12, 2.4]; // high-side tray on the enclave apron
export const TRAY = { w: 1.3, h: 0.12, d: 0.9 } as const;
export const CONSOLES: [V3, V3] = [
  [8.6, 0, 2.7],
  [9.6, 0, 2.7],
];
export const CHUNK_GRID = { cols: 8, rows: 4, dx: 0.15, dz: 0.2, y: 0.22 } as const; // 32 slots per tray
export const CHUNK_SIZE: V3 = [0.12, 0.08, 0.16];
export const CHUNKS_MAX = CHUNK_GRID.cols * CHUNK_GRID.rows;

export function chunkSlot(tray: V3, i: number): V3 {
  return [tray[0] - 0.525 + (i % CHUNK_GRID.cols) * CHUNK_GRID.dx, tray[1] + CHUNK_GRID.y, tray[2] - 0.3 + ((i / CHUNK_GRID.cols) | 0) * CHUNK_GRID.dz];
}

export function trayRect(tray: V3): Rect {
  return { x0: tray[0] - TRAY.w / 2, x1: tray[0] + TRAY.w / 2, z0: tray[2] - TRAY.d / 2, z1: tray[2] + TRAY.d / 2 };
}

/* ------------------------------------------------------------------ artefact channel stops (token hover points) */
export const STOPS = {
  bench: [BENCH[0], 0.7, BENCH[2]],
  cloudRegistry: [SITE.cloud[0] + moduleLocal(5)[0], 0.95, SITE.cloud[2] + moduleLocal(5)[2]],
  proxy: [PROXY_X, 0.9, -1.9],
  onpremRegistry: [SITE.onprem[0] + moduleLocal(5)[0], 0.95, SITE.onprem[2] + moduleLocal(5)[2]],
  outbox: [OUTBOX[0], 0.4, OUTBOX[2]],
  quarantine: [QUARANTINE[0], 0.4, QUARANTINE[2]],
  enclaveRegistry: [SITE.airgapped[0] + moduleLocal(5)[0], 0.95, SITE.airgapped[2] + moduleLocal(5)[2]],
} as const satisfies Record<string, V3>;

/* ------------------------------------------------------------------ routes */
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const A = v(ARCH[0], 0.9, ARCH[2]);
const trunk = new THREE.QuadraticBezierCurve3(v(HUB[0], 0.9, HUB[2]), v(0, 1.25, 5.8), A.clone());
const fan: Record<EnvId, THREE.Curve<THREE.Vector3>> = {
  cloud: new THREE.QuadraticBezierCurve3(A.clone(), v(-6.0, 2.6, 4.4), v(...siteGate("cloud"))),
  onprem: new THREE.QuadraticBezierCurve3(A.clone(), v(0, 1.6, 2.8), v(...siteGate("onprem"))),
  airgapped: new THREE.CatmullRomCurve3([A.clone(), v(3.0, 1.1, 3.7), v(...GATE), v(7.8, 1.5, 1.9), v(...siteGate("airgapped"))], false, "centripetal"),
};

/** Trunk hub → arch, then the fan to the site gate. Every routed packet passes the arch first. */
export function routeCurve(to: EnvId): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(trunk);
  path.add(fan[to]);
  return path;
}

/** Hub → just short of the arch: where refused packets burst. */
export function refusedCurve(): THREE.QuadraticBezierCurve3 {
  return new THREE.QuadraticBezierCurve3(v(HUB[0], 0.9, HUB[2]), v(0, 1.25, 5.8), v(0, 0.9, 4.55));
}

export const ROUTE_LINES = {
  trunk: trunk.getPoints(12),
  cloud: fan.cloud.getPoints(48),
  onprem: fan.onprem.getPoints(24),
  airgapped: fan.airgapped.getSpacedPoints(64),
};

/** Artefact channel: bench → cloud registry → proxy → on-prem registry → outbox, and quarantine → enclave registry. */
export const CHANNEL = {
  publish: new THREE.QuadraticBezierCurve3(v(...STOPS.bench), v(-9.0, 3.4, 4.0), v(...STOPS.cloudRegistry)),
  mirror: new THREE.CatmullRomCurve3([v(...STOPS.cloudRegistry), v(-9.5, 1.9, -1.9), v(...STOPS.proxy), v(-3.9, 1.5, -1.9), v(...STOPS.onpremRegistry)], false, "centripetal"),
  stage: new THREE.QuadraticBezierCurve3(v(...STOPS.onpremRegistry), v(0.6, 2.2, 0.6), v(...STOPS.outbox)),
  import: new THREE.QuadraticBezierCurve3(v(...STOPS.quarantine), v(7.4, 1.8, 0.2), v(...STOPS.enclaveRegistry)),
};

/* ------------------------------------------------------------------ camera */
export const CAMERA_FOV = 40;
/** Height of the caption box drawn over the bottom of the scene frame while the director plays. */
export const CAPTION_PX = 110;
const OVERVIEW_TARGET: V3 = [0, 0, 2.5];
const OVERVIEW_DIR = v(0, 26, 23).normalize();
/** Points that must stay inside the frame at the overview (world x/y/z). */
const OVERVIEW_FIT: V3[] = [
  [-ZONE_HALF_W + ZONE_CX.cloud, 0, ZONE_Z0],
  [ZONE_HALF_W + ZONE_CX.airgapped, 0, ZONE_Z0],
  [-ZONE_HALF_W + ZONE_CX.cloud, 2.8, ZONE_Z0],
  [ZONE_HALF_W + ZONE_CX.airgapped, 2.8, ZONE_Z0],
  [-ZONE_HALF_W + ZONE_CX.cloud, 0, ZONE_Z1],
  [ZONE_HALF_W + ZONE_CX.airgapped, 0, ZONE_Z1],
  [-STRIP_HALF_W, 0, STRIP_Z1],
  [STRIP_HALF_W, 0, STRIP_Z1],
];
/** Points that must clear the caption box (the hub and ledger headlines). */
const OVERVIEW_CLEAR: V3[] = [
  [HUB[0], 2.4, HUB[2]],
  [OBELISK[0], 3.5, OBELISK[2]],
];
const FIT_MARGIN = 0.94;

const solverCamera = new THREE.PerspectiveCamera(CAMERA_FOV, 1.5, 0.1, 200);
const solverPoint = new THREE.Vector3();
const solverTarget = v(...OVERVIEW_TARGET);

function overviewFits(distance: number, aspect: number, captionTopNdc: number): boolean {
  solverCamera.aspect = aspect;
  solverCamera.updateProjectionMatrix();
  solverCamera.position.copy(solverTarget).addScaledVector(OVERVIEW_DIR, distance);
  solverCamera.lookAt(solverTarget);
  solverCamera.updateMatrixWorld(true);
  for (const p of OVERVIEW_FIT) {
    solverPoint.set(p[0], p[1], p[2]).project(solverCamera);
    if (Math.abs(solverPoint.x) > FIT_MARGIN || solverPoint.y > FIT_MARGIN || solverPoint.y < -0.99) return false;
  }
  for (const p of OVERVIEW_CLEAR) {
    solverPoint.set(p[0], p[1], p[2]).project(solverCamera);
    if (Math.abs(solverPoint.x) > FIT_MARGIN || solverPoint.y < captionTopNdc) return false;
  }
  return true;
}

/**
 * Overview pose for a given frame: the closest camera along the fixed overview direction
 * from which the whole gradient fits and the hub/ledger headlines clear the caption box.
 * Pure geometry (no DOM), so the layout test can assert it for several frame shapes.
 */
export function overviewPose(aspect: number, heightPx: number): { pos: V3; target: V3; distance: number } {
  const safeAspect = Number.isFinite(aspect) && aspect > 0.2 ? aspect : 1.5;
  const safeHeight = Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 560;
  const captionTopNdc = Math.min(0.2, -1 + (2 * CAPTION_PX) / safeHeight + 0.05);
  let lo = 16;
  let hi = 90;
  if (!overviewFits(hi, safeAspect, captionTopNdc)) lo = hi;
  else {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (overviewFits(mid, safeAspect, captionTopNdc)) hi = mid;
      else lo = mid;
    }
    lo = hi;
  }
  const distance = Math.round(lo * 100) / 100;
  const pos = solverTarget.clone().addScaledVector(OVERVIEW_DIR, distance);
  return { pos: [round2(pos.x), round2(pos.y), round2(pos.z)], target: OVERVIEW_TARGET, distance };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Default frame: the 7/12-wide scene panel at 1440 × 900 (about 820 × 560). */
export const DEFAULT_FRAME = { width: 820, height: 560 } as const;

export const CAMERA_PRESETS: Record<Focus, { pos: V3; target: V3 }> = {
  overview: overviewPose(DEFAULT_FRAME.width / DEFAULT_FRAME.height, DEFAULT_FRAME.height),
  hub: { pos: [0, 6.5, 14.5], target: [0, 0.9, 6.4] },
  cloud: { pos: [-15.5, 7.5, 8], target: [-10.3, 0.7, -1.2] },
  onprem: { pos: [-4.5, 7.5, 9], target: [0.2, 0.7, -1.2] },
  diode: { pos: [2.0, 7.0, 10], target: [5.6, 0.8, 1.8] },
  airgapped: { pos: [15, 8, 8.5], target: [10.3, 0.7, -0.8] },
};
