import type { Classification, EnvId, NetworkPosture } from "@/engine";

/**
 * Single colour source for the 3D scene and the 2D map.
 * Every hex equals the matching token in `src/app/globals.css` (:root), so the
 * WebGL canvas and the DOM chrome never drift apart.
 */
export const MJC = {
  bg: "#05070b",
  fg: "#d6e2f0",
  card: "#0a0f17",
  secondary: "#101825",
  muted: "#0f1622",
  mutedFg: "#7e8fa5",
  border: "#1a2433",
  accent: "#0f2a33",
  cyan: "#22d3ee",
  amber: "#f59e0b",
  red: "#f43f5e",
  green: "#34d399",
  violet: "#a78bfa",
} as const;

export type Tone = "cyan" | "amber" | "red" | "green" | "violet";

export const CLASS_HEX: Record<Classification, string> = {
  OPEN: MJC.cyan,
  RESTRICTED: MJC.amber,
  SECRET: MJC.red,
  ONYX: MJC.violet,
};

export const ENV_ACCENT: Record<EnvId, string> = {
  cloud: MJC.cyan,
  onprem: MJC.amber,
  airgapped: MJC.red,
};

export const ENV_TONE: Record<EnvId, Tone> = {
  cloud: "cyan",
  onprem: "amber",
  airgapped: "red",
};

export const NET_LABEL: Record<NetworkPosture, string> = {
  EXTERNAL: "EXTERNAL",
  PROXIED: "PROXIED",
  NONE: "NO NETWORK",
};

/** Floor-plate tints, one per perimeter: a whisper of the accent over the card colour. */
export const ZONE_TINT: Record<EnvId, string> = {
  cloud: "#07111a",
  onprem: "#0f0c06",
  airgapped: "#110609",
};

/**
 * The scene font is served locally so the control room never touches the network.
 * troika-three-text has no bundled default font: with a missing font or a glyph
 * outside the file it fetches a fallback from a CDN, which the no-network rule forbids.
 */
export const SCENE_FONT = "/fonts/GeistMono-Regular.ttf";

const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");

/**
 * Every character any 3D label may contain: printable ASCII plus the handful of
 * typographic glyphs verified present in GeistMono-Regular.ttf (cmap parsed at
 * design time). `✓ ▮ ▪` are deliberately absent because the font lacks them and
 * troika would fall back to a CDN fetch. `tests/scene/labels.test.ts` enforces this.
 */
export const SCENE_GLYPHS = `${PRINTABLE_ASCII}·→←×–—…•`;

const GLYPH_SET = new Set(SCENE_GLYPHS);

/** True when every character of `text` is in SCENE_GLYPHS (newlines are layout, not glyphs). */
export function hasSceneGlyphs(text: string): boolean {
  for (const ch of text) {
    if (ch === "\n") continue;
    if (!GLYPH_SET.has(ch)) return false;
  }
  return true;
}

/** Characters of `text` that are outside SCENE_GLYPHS, for test diagnostics. */
export function missingSceneGlyphs(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) if (ch !== "\n" && !GLYPH_SET.has(ch)) out.add(ch);
  return [...out];
}
