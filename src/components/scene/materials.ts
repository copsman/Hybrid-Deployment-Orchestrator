/**
 * Shared materials and geometries for the scene, created lazily on first use so the
 * module can be imported by client components without touching WebGL at import time.
 *
 * Rule: a JSX `<meshStandardMaterial>` literal is allowed only for a material that
 * exactly one owner mutates per frame (barrier field, gate ring, tower cap, console
 * screens, bounce sphere, packets). Everything else uses these singletons.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { EnvId } from "@/engine";
import { MJC, ZONE_TINT, type Tone } from "@/lib/palette";
import { CHUNK_SIZE, MODULE, RING_R, TOWER, moduleLocal } from "./layout";

export interface SceneMaterials {
  pad: THREE.MeshStandardMaterial;
  body: THREE.MeshStandardMaterial;
  module: THREE.MeshStandardMaterial;
  plate: Record<EnvId, THREE.MeshStandardMaterial>;
  strip: THREE.MeshStandardMaterial;
  accent: Record<Tone, THREE.MeshStandardMaterial>;
  glow: Record<Tone, THREE.MeshBasicMaterial>;
  ledOff: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  unlit: THREE.MeshBasicMaterial;
}

export interface SceneGeometries {
  unitBox: THREE.BoxGeometry;
  module: RoundedBoxGeometry;
  /** outline of the nine low modules of one campus, merged into a single line segment set */
  moduleEdges: THREE.BufferGeometry;
  tower: THREE.BoxGeometry;
  led: THREE.SphereGeometry;
  pod: THREE.CylinderGeometry;
  token: THREE.BoxGeometry;
  chunk: THREE.BoxGeometry;
  link: THREE.TorusGeometry;
  ring: THREE.TorusGeometry;
}

const TONES: Tone[] = ["cyan", "amber", "red", "green", "violet"];

let materialCache: SceneMaterials | null = null;
let geometryCache: SceneGeometries | null = null;

function standard(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(params);
}

function byTone<T>(make: (tone: Tone) => T): Record<Tone, T> {
  const out = {} as Record<Tone, T>;
  for (const tone of TONES) out[tone] = make(tone);
  return out;
}

export function materials(): SceneMaterials {
  if (materialCache) return materialCache;
  materialCache = {
    pad: standard({ color: MJC.card, metalness: 0.6, roughness: 0.45 }),
    body: standard({ color: "#0d1420", metalness: 0.55, roughness: 0.5 }),
    module: standard({ color: "#151f2e", metalness: 0.5, roughness: 0.5 }),
    plate: {
      cloud: standard({ color: ZONE_TINT.cloud, metalness: 0.3, roughness: 0.8 }),
      onprem: standard({ color: ZONE_TINT.onprem, metalness: 0.3, roughness: 0.8 }),
      airgapped: standard({ color: ZONE_TINT.airgapped, metalness: 0.3, roughness: 0.8 }),
    },
    strip: standard({ color: "#080c13", metalness: 0.4, roughness: 0.7 }),
    accent: byTone((tone) => standard({ color: MJC[tone], emissive: MJC[tone], emissiveIntensity: 1.4, toneMapped: false })),
    glow: byTone((tone) => new THREE.MeshBasicMaterial({ color: MJC[tone], transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })),
    ledOff: standard({ color: MJC.border, emissive: "#000000", roughness: 0.6 }),
    wall: standard({ color: "#1a0d12", emissive: MJC.red, emissiveIntensity: 0.25, transparent: true, opacity: 0.9, metalness: 0.3, roughness: 0.7 }),
    glass: standard({ color: "#1a0d12", transparent: true, opacity: 0.28, roughness: 0.2, metalness: 0.1, depthWrite: false }),
    white: standard({ color: "#ffffff", metalness: 0.45, roughness: 0.55 }),
    unlit: new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
  };
  return materialCache;
}

function moduleEdges(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(MODULE.size, MODULE.h, MODULE.size);
  const edges = new THREE.EdgesGeometry(box);
  const single = edges.attributes.position.array;
  const all: number[] = [];
  for (let i = 0; i < MODULE.cols * MODULE.rowZ.length; i++) {
    if (i === TOWER.index) continue;
    const [x, y, z] = moduleLocal(i);
    for (let j = 0; j < single.length; j += 3) all.push(single[j] + x, single[j + 1] + y, single[j + 2] + z);
  }
  box.dispose();
  edges.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(all, 3));
  return out;
}

export function geometries(): SceneGeometries {
  if (geometryCache) return geometryCache;
  geometryCache = {
    unitBox: new THREE.BoxGeometry(1, 1, 1),
    module: new RoundedBoxGeometry(1, 0.6, 1, 2, 0.08),
    moduleEdges: moduleEdges(),
    tower: new THREE.BoxGeometry(1, 1.9, 1),
    led: new THREE.SphereGeometry(0.09, 10, 10),
    pod: new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12),
    token: new THREE.BoxGeometry(0.3, 0.3, 0.3),
    chunk: new THREE.BoxGeometry(CHUNK_SIZE[0], CHUNK_SIZE[1], CHUNK_SIZE[2]),
    link: new THREE.TorusGeometry(0.28, 0.015, 4, 24),
    // a 300° arc: the gap makes the busy spin visible, a full torus would look static
    ring: new THREE.TorusGeometry(RING_R, 0.02, 6, 96, Math.PI * 1.65),
  };
  return geometryCache;
}
