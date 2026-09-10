/**
 * Coordinates for the 2D map (viewBox 1000 × 560), the honest mirror of the 3D
 * linear security gradient: PERIMETER 01 CLOUD | PERIMETER 02 SOVEREIGN | diode
 * wall | PERIMETER 03 ENCLAVE across the top, the POLICY PLANE strip along the
 * bottom, the policy-barrier arch between them. Everything sits above y ≈ 440
 * because the control room's caption box covers the bottom of the frame while the
 * scenario plays. Plain numbers only: this module is imported by the CI path and
 * must never pull in three.js.
 */
import type { EnvId } from "@/engine";

export type P = [number, number];

export const VIEW_W = 1000;
export const VIEW_H = 560;
export const MONO = "var(--font-geist-mono)";
export const SANS = "var(--font-geist-sans)";

/* ------------------------------------------------------------------ perimeters */
export const ZONE_Y0 = 34;
export const ZONE_Y1 = 322;
export const ZONE_W = 300;
export const ZONE_X: Record<EnvId, number> = { cloud: 22, onprem: 342, airgapped: 678 };
export const ZONE_NO: Record<EnvId, string> = { cloud: "01", onprem: "02", airgapped: "03" };
export const ZONE_WORD: Record<EnvId, string> = { cloud: "CLOUD", onprem: "SOVEREIGN", airgapped: "ENCLAVE" };
export const TRUST_MARK: Record<EnvId, string> = { cloud: "TRUST · EXTERNAL TENANCY", onprem: "TRUST · MJC-CONTROLLED", airgapped: "TRUST · ACCREDITED" };

/* ------------------------------------------------------------------ campus (relative to the zone's left edge) */
export const PAD = { dx: 40, y: 108, w: 220, h: 96 } as const;
export const TILE = { w: 36, h: 22, dx0: 55, pitch: 42, rows: [120, 156] as const } as const;
/** index of the Model-serving layer in every spec.stack (the tower in 3D, the LED tile here) */
export const SERVING_INDEX = 2;
/** index of the Registry layer: where the artefact token lands */
export const REGISTRY_INDEX = 5;
export const GATE_DX = 150;
export const GATE_Y = 212;
export const HEADLINE_Y = { codename: 70, name: 82, stats: 94 } as const;
export const MAST_DX = 250;
export const POD = { pitch: 11.5, h: 9 } as const;

export function tileOrigin(zx: number, i: number): P {
  return [zx + TILE.dx0 + (i % 5) * TILE.pitch, TILE.rows[Math.floor(i / 5)]];
}
export function tileCentre(zx: number, i: number): P {
  const [x, y] = tileOrigin(zx, i);
  return [x + TILE.w / 2, y + TILE.h / 2];
}
export function siteGate(id: EnvId): P {
  return [ZONE_X[id] + GATE_DX, GATE_Y];
}
export function registryTile(id: EnvId): P {
  return tileCentre(ZONE_X[id], REGISTRY_INDEX);
}
/** Where the artefact token parks: just under the Registry tile, so the tile's label stays readable. */
export function registryRest(id: EnvId): P {
  const [x, y] = tileOrigin(ZONE_X[id], REGISTRY_INDEX);
  return [x + TILE.w / 2, y + TILE.h + 8];
}

export const LAYER_ABBR: Record<string, string> = {
  App: "APP",
  "AI gateway": "GATEWAY",
  "Model serving": "SERVING",
  Database: "DB",
  Identity: "IDENTITY",
  Registry: "REGISTRY",
  Secrets: "SECRETS",
  Observability: "OBSERVE",
  Updates: "UPDATES",
  Network: "NETWORK",
};

/** Queue tokens come from the shared string-key selector; re-exported so the map has one geometry import. */
export { parseQueueKey, type QueueEntry } from "../selectors";

/* ------------------------------------------------------------------ crossings */
/** Inspection proxy on the cloud → sovereign boundary; the mirror flight (registry row, y ≈ 186) passes through its opening. */
export const PROXY = { x: 332, y0: 166, y1: 202 } as const;
export const WALL = { x: 652, w: 16 } as const;
export const GATE: P = [660, 266];
/** Text stack above the gate: status line, DIODE, counter box. */
export const DIODE_TEXT = { status: 218, title: 232, counterTop: 240, counter: 249 } as const;
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const OUTBOX: Box = { x: 600, y: 292, w: 36, h: 20 };
export const QUARANTINE: Box = { x: 684, y: 292, w: 36, h: 20 };
export const TICKS = { x: 604, y: 316, w: 2.6, pitch: 3.5, h: 6 } as const;
export const CONSOLES: readonly P[] = [
  [740, 296],
  [860, 296],
];
export function boxCentre(b: Box): P {
  return [b.x + b.w / 2, b.y + b.h / 2];
}

/* ------------------------------------------------------------------ policy plane */
export const STRIP: Box = { x: 22, y: 350, w: 956, h: 90 };
export const HUB: P = [500, 404];
export const HUB_R = 22;
export const BENCH: P = [400, 404];
export const BENCH_REST: P = [400, 380];
export const OBELISK: P = [600, 406];
export const ARCH = { cx: 500, top: 322, bottom: 344, halfW: 30 } as const;
export const VERDICT_Y = 362;

/* ------------------------------------------------------------------ routes */
export function quad(p0: P, c: P, p1: P, n = 20): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const d = t * t;
    pts.push([a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1]]);
  }
  return pts;
}

/** Re-samples a polyline into `n + 1` points evenly spaced by arc length, so keyframe motion runs at constant speed. */
export function resample(pts: P[], n: number): P[] {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const out: P[] = [];
  let seg = 1;
  for (let k = 0; k <= n; k++) {
    const target = (k / n) * total;
    while (seg < cum.length - 1 && cum[seg] < target) seg++;
    const len = cum[seg] - cum[seg - 1];
    const t = len > 0 ? (target - cum[seg - 1]) / len : 0;
    out.push([pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * t, pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * t]);
  }
  return out;
}

export function pathD(pts: P[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

const ARCH_EXIT: P = [ARCH.cx, ARCH.top];
/** Hub → barrier arch: the single exit from the policy plane. */
export const TRUNK: P[] = [
  [HUB[0], HUB[1] - HUB_R - 7],
  [ARCH.cx, ARCH.bottom],
  ARCH_EXIT,
];
/** Fan from the arch: cloud NW, on-prem straight, air-gapped east and through the diode gate. */
export const FAN: Record<EnvId, P[]> = {
  cloud: quad(ARCH_EXIT, [300, ARCH.top], siteGate("cloud")),
  onprem: quad(ARCH_EXIT, [496, 270], siteGate("onprem")),
  airgapped: [...quad(ARCH_EXIT, [600, ARCH.top], [600, GATE[1]]), [700, GATE[1]], ...quad([700, GATE[1]], [770, GATE[1]], siteGate("airgapped")).slice(1)],
};
export const ROUTE: Record<EnvId, P[]> = {
  cloud: resample([...TRUNK, ...FAN.cloud.slice(1)], 48),
  onprem: resample([...TRUNK, ...FAN.onprem.slice(1)], 48),
  airgapped: resample([...TRUNK, ...FAN.airgapped.slice(1)], 48),
};
/** Trunk only: a refused packet stops inside the barrier field. */
export const REFUSED: P[] = resample([TRUNK[0], [ARCH.cx, ARCH.top + 14]], 12);
