import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ENVIRONMENTS, ENV_IDS, type EnvId } from "../../src/engine";
import {
  ARCH,
  BENCH,
  CAMERA_PRESETS,
  CAPTION_PX,
  CHANNEL,
  CHUNKS_MAX,
  CONSOLES,
  GATE,
  GATE_R,
  HUB,
  OBELISK,
  OUTBOX,
  PAD,
  PLAQUE,
  PLAQUE_LOCAL,
  PROXY_X,
  QUARANTINE,
  QUEUE_LOCAL,
  ROUTE_LINES,
  SITE,
  STOPS,
  STRIP_RECT,
  WALL_X,
  ZONE_CX,
  ZONE_ORDER,
  chunkSlot,
  moduleLocal,
  overviewPose,
  queueSlot,
  refusedCurve,
  routeCurve,
  siteGate,
  trayRect,
  zoneRect,
  type Rect,
  type V3,
} from "../../src/components/scene/layout";
import { LAYER_ORDER } from "../../src/components/scene/labels";

const FOCUS_VALUES = ["overview", "hub", "diode", "cloud", "onprem", "airgapped"];

function disjoint(a: Rect, b: Rect): boolean {
  return a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0;
}

function inside(p: { x: number; z: number }, r: Rect, margin = 0): boolean {
  return p.x >= r.x0 + margin && p.x <= r.x1 - margin && p.z >= r.z0 + margin && p.z <= r.z1 - margin;
}

function rectInside(inner: Rect, outer: Rect): boolean {
  return inner.x0 >= outer.x0 && inner.x1 <= outer.x1 && inner.z0 >= outer.z0 && inner.z1 <= outer.z1;
}

function samples(curve: THREE.Curve<THREE.Vector3>, n = 400): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) out.push(curve.getPoint(i / n));
  return out;
}

describe("scene layout: linear security gradient", () => {
  it("lays the three zone plates and the policy strip out disjoint, in trust order left to right", () => {
    const rects = ZONE_ORDER.map(zoneRect).concat(STRIP_RECT);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(disjoint(rects[i], rects[j]), `${i} vs ${j}`).toBe(true);
    expect(ZONE_ORDER).toEqual(["cloud", "onprem", "airgapped"]);
    expect(ZONE_CX.cloud).toBeLessThan(ZONE_CX.onprem);
    expect(ZONE_CX.onprem).toBeLessThan(ZONE_CX.airgapped);
    for (const id of ZONE_ORDER) expect(zoneRect(id).z1).toBeLessThanOrEqual(STRIP_RECT.z0);
  });

  it("puts the proxy checkpoint and the diode wall in the gaps between plates", () => {
    expect(PROXY_X).toBeGreaterThan(zoneRect("cloud").x1);
    expect(PROXY_X).toBeLessThan(zoneRect("onprem").x0);
    expect(WALL_X).toBeGreaterThan(zoneRect("onprem").x1);
    expect(WALL_X).toBeLessThan(zoneRect("airgapped").x0);
  });

  it("keeps every campus part inside its own zone", () => {
    for (const id of ZONE_ORDER) {
      const zone = zoneRect(id);
      const [sx, , sz] = SITE[id];
      const pad: Rect = { x0: sx - PAD.w / 2, x1: sx + PAD.w / 2, z0: sz - PAD.d / 2, z1: sz + PAD.d / 2 };
      expect(rectInside(pad, zone), `${id} pad`).toBe(true);
      for (let i = 0; i < 10; i++) {
        const [mx, , mz] = moduleLocal(i);
        expect(inside({ x: sx + mx, z: sz + mz }, pad, 0.5), `${id} module ${i}`).toBe(true);
      }
      const gate = siteGate(id);
      expect(inside({ x: gate[0], z: gate[2] }, zone), `${id} gate`).toBe(true);
      for (let k = 0; k <= QUEUE_LOCAL.visible; k++) {
        const q = queueSlot(id, k);
        expect(inside({ x: q[0], z: q[2] }, zone, 0.15), `${id} queue token ${k}`).toBe(true);
      }
      expect(inside({ x: sx + PLAQUE_LOCAL[0], z: sz + PLAQUE_LOCAL[2] }, zone, PLAQUE.w / 2), `${id} plaque`).toBe(true);
    }
  });

  it("stages the outbox on the on-prem apron and the quarantine tray plus consoles inside the enclave", () => {
    expect(rectInside(trayRect(OUTBOX), zoneRect("onprem"))).toBe(true);
    expect(rectInside(trayRect(QUARANTINE), zoneRect("airgapped"))).toBe(true);
    for (const c of CONSOLES) expect(inside({ x: c[0], z: c[2] }, zoneRect("airgapped"), 0.2)).toBe(true);
    expect(disjoint(trayRect(OUTBOX), trayRect(QUARANTINE))).toBe(true);
    expect(OUTBOX[0]).toBeLessThan(WALL_X);
    expect(QUARANTINE[0]).toBeGreaterThan(WALL_X);
  });

  it("routes every job through the barrier arch first, then fans out without crossing", () => {
    for (const id of ENV_IDS) {
      const pts = samples(routeCurve(id));
      const start = pts[0];
      expect(start.distanceTo(new THREE.Vector3(HUB[0], 0.9, HUB[2]))).toBeLessThan(1e-6);
      const nearArch = pts.some((p) => Math.abs(p.x - ARCH[0]) < 0.05 && Math.abs(p.z - ARCH[2]) < 0.05);
      expect(nearArch, `${id} passes the arch`).toBe(true);
      const end = pts[pts.length - 1];
      expect(end.distanceTo(new THREE.Vector3(...siteGate(id)))).toBeLessThan(1e-6);
    }
    const refused = samples(refusedCurve());
    expect(refused[refused.length - 1].z).toBeGreaterThan(ARCH[2]);
    expect(refused.every((p) => p.z >= ARCH[2] - 1e-6)).toBe(true);
  });

  it("crosses the diode wall only on the air-gapped route and only through the gate aperture", () => {
    const air = samples(routeCurve("airgapped"), 2000);
    const crossing = air.filter((p) => Math.abs(p.x - WALL_X) < 0.3);
    expect(crossing.length).toBeGreaterThan(0);
    for (const p of crossing) {
      expect(Math.abs(p.z - GATE[2])).toBeLessThan(GATE_R);
      expect(Math.abs(p.y - GATE[1])).toBeLessThan(GATE_R);
      expect(p.y).toBeGreaterThan(0.3);
      expect(p.y).toBeLessThan(1.5);
    }
    for (const id of ["cloud", "onprem"] as EnvId[]) {
      for (const p of samples(routeCurve(id))) expect(Math.abs(p.x - WALL_X), `${id} stays clear of the wall`).toBeGreaterThan(0.2);
    }
    for (const p of ROUTE_LINES.airgapped) if (Math.abs(p.x - WALL_X) < 0.3) expect(Math.abs(p.z - GATE[2])).toBeLessThan(GATE_R);
  });

  it("parks all 32 chunk slots inside their tray footprint", () => {
    for (const tray of [OUTBOX, QUARANTINE]) {
      const r = trayRect(tray);
      for (let i = 0; i < CHUNKS_MAX; i++) {
        const [x, y, z] = chunkSlot(tray, i);
        expect(inside({ x, z }, r, 0.06), `slot ${i}`).toBe(true);
        expect(y).toBeGreaterThan(tray[1]);
      }
    }
  });

  it("carries the artefact channel through the registry tiles, the proxy and the outbox", () => {
    const registry = 5;
    for (const id of ENV_IDS) {
      const stop = id === "cloud" ? STOPS.cloudRegistry : id === "onprem" ? STOPS.onpremRegistry : STOPS.enclaveRegistry;
      const [mx, , mz] = moduleLocal(registry);
      expect(stop[0]).toBeCloseTo(SITE[id][0] + mx, 6);
      expect(stop[2]).toBeCloseTo(SITE[id][2] + mz, 6);
    }
    expect(STOPS.proxy[0]).toBe(PROXY_X);
    const mirror = samples(CHANNEL.mirror);
    expect(mirror.some((p) => Math.abs(p.x - PROXY_X) < 0.05)).toBe(true);
    expect(CHANNEL.stage.getPoint(1).distanceTo(new THREE.Vector3(...STOPS.outbox))).toBeLessThan(1e-6);
    expect(CHANNEL.import.getPoint(0).distanceTo(new THREE.Vector3(...STOPS.quarantine))).toBeLessThan(1e-6);
    for (const p of samples(CHANNEL.publish).concat(samples(CHANNEL.mirror), samples(CHANNEL.stage))) expect(p.x).toBeLessThan(WALL_X);
    expect(STOPS.bench[0]).toBe(BENCH[0]);
  });

  it("maps the same ten-layer stack onto the same module grid in every environment", () => {
    for (const id of ENV_IDS) expect(ENVIRONMENTS[id].stack.map((s) => s.layer)).toEqual([...LAYER_ORDER]);
    const xs = new Set<number>();
    for (let i = 0; i < 10; i++) xs.add(Math.round(moduleLocal(i)[0] * 1000));
    expect(xs.size).toBe(5);
    expect(moduleLocal(2)[1]).toBeGreaterThan(moduleLocal(1)[1]);
  });

  it("has exactly one camera preset per Focus value", () => {
    expect(Object.keys(CAMERA_PRESETS).sort()).toEqual([...FOCUS_VALUES].sort());
    for (const key of FOCUS_VALUES) {
      const p = CAMERA_PRESETS[key as keyof typeof CAMERA_PRESETS];
      expect(p.pos).toHaveLength(3);
      expect(p.target).toHaveLength(3);
      expect(p.pos[1]).toBeGreaterThan(p.target[1]);
    }
  });

  it("solves an overview that fits the gradient and clears the caption box at every frame shape", () => {
    const frames: [number, number][] = [
      [820, 560], // default 7/12 panel at 1440 x 900
      [940, 560], // 8/12 jury panel
      [1400, 380], // stacked layout below xl, minimum frame height
      [766, 438], // 1366 x 768 laptop
      [700, 560], // narrow window
    ];
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    const p = new THREE.Vector3();
    const corners: V3[] = [
      [ZONE_CX.cloud - 4.8, 0, -6.5],
      [ZONE_CX.airgapped + 4.8, 0, -6.5],
      [ZONE_CX.cloud - 4.8, 2.8, -6.5],
      [ZONE_CX.airgapped + 4.8, 2.8, -6.5],
      [ZONE_CX.cloud - 4.8, 0, 3.5],
      [ZONE_CX.airgapped + 4.8, 0, 3.5],
      [STRIP_RECT.x0, 0, STRIP_RECT.z1],
      [STRIP_RECT.x1, 0, STRIP_RECT.z1],
    ];
    for (const [w, h] of frames) {
      const pose = overviewPose(w / h, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      cam.position.set(...pose.pos);
      cam.lookAt(new THREE.Vector3(...pose.target));
      cam.updateMatrixWorld(true);
      for (const c of corners) {
        p.set(...c).project(cam);
        expect(Math.abs(p.x), `${w}x${h} corner x ${c}`).toBeLessThanOrEqual(0.95);
        expect(p.y, `${w}x${h} corner y ${c}`).toBeLessThanOrEqual(0.95);
        expect(p.y, `${w}x${h} corner y ${c}`).toBeGreaterThanOrEqual(-1);
      }
      const captionTop = -1 + (2 * CAPTION_PX) / h;
      for (const c of [
        [HUB[0], 2.4, HUB[2]],
        [OBELISK[0], 3.5, OBELISK[2]],
      ] as V3[]) {
        p.set(...c).project(cam);
        expect(p.y, `${w}x${h} headline ${c} clears the caption`).toBeGreaterThan(captionTop);
      }
      const camPos = new THREE.Vector3(...pose.pos);
      const farthest = Math.max(...corners.map((c) => camPos.distanceTo(new THREE.Vector3(...c))));
      expect(farthest, `${w}x${h} far corners stay in front of the fog`).toBeLessThan(60);
      expect(pose.distance).toBeGreaterThan(10);
      expect(pose.distance).toBeLessThan(60);
    }
    const wide = overviewPose(1400 / 380, 380);
    const narrow = overviewPose(700 / 560, 560);
    expect(wide.distance).toBeLessThan(narrow.distance);
  });
});
