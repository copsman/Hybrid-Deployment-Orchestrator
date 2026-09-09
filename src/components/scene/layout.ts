import * as THREE from "three";
import type { EnvId } from "@/engine";
import type { Focus } from "@/engine/scenario";

export type V3 = [number, number, number];

export const HUB: V3 = [0, 0, 0];
export const SITES: Record<EnvId, V3> = {
  cloud: [-7, 2.4, -4.5],
  onprem: [7, 0, -3.5],
  airgapped: [7.5, 0, 5.5],
};
export const WALL_X = 3.6;
export const GATE: V3 = [WALL_X, 0.7, 5.5];
export const BARRIER: V3 = [0, 0.7, 2.8];

export const CAMERA_PRESETS: Record<Focus, { pos: V3; target: V3 }> = {
  overview: { pos: [0, 11, 17.5], target: [0.5, 0.4, 0.8] },
  hub: { pos: [0.5, 5, 7.5], target: [0, 0.6, 0] },
  cloud: { pos: [-10.5, 6.5, 1.5], target: [-7, 2.2, -4.5] },
  onprem: { pos: [10.5, 4.5, 2.5], target: [7, 0.6, -3.5] },
  airgapped: { pos: [9.5, 4.5, 12], target: [7, 0.7, 5.5] },
  diode: { pos: [3.6, 4.2, 12.5], target: [3.6, 0.7, 5.5] },
};

export function routeCurve(to: EnvId): THREE.QuadraticBezierCurve3 {
  const end = SITES[to];
  const start = new THREE.Vector3(HUB[0], 0.9, HUB[2]);
  const finish = new THREE.Vector3(end[0], end[1] + 0.9, end[2]);
  const mid = start.clone().lerp(finish, 0.5);
  mid.y += to === "cloud" ? 3.2 : 2.4;
  if (to === "airgapped") mid.x -= 1.5;
  return new THREE.QuadraticBezierCurve3(start, mid, finish);
}

export function refusedCurve(): THREE.QuadraticBezierCurve3 {
  const start = new THREE.Vector3(HUB[0], 0.9, HUB[2]);
  const finish = new THREE.Vector3(BARRIER[0], BARRIER[1], BARRIER[2] - 0.2);
  const mid = start.clone().lerp(finish, 0.5);
  mid.y += 0.8;
  return new THREE.QuadraticBezierCurve3(start, mid, finish);
}

export const CLASS_COLOR: Record<string, string> = {
  OPEN: "#22d3ee",
  RESTRICTED: "#f59e0b",
  SECRET: "#f43f5e",
  ONYX: "#a78bfa",
};
