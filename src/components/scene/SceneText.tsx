"use client";

import type { Ref } from "react";
import type * as THREE from "three";
import { Text } from "@react-three/drei";
import { MJC, SCENE_FONT, SCENE_GLYPHS } from "@/lib/palette";
import type { V3 } from "./layout";

/**
 * The troika text mesh behind drei's <Text>. `fillOpacity` is applied at render time, so
 * a per-frame write through `textRef` needs no re-render and no sync().
 */
export interface SceneTextHandle extends THREE.Mesh {
  fillOpacity: number;
  text: string;
  color: string | number;
}

export interface SceneTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "middle" | "bottom";
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  maxWidth?: number;
  /** world units for in-world text; pixels when `screen` is set (see below) */
  outlineWidth?: number;
  fillOpacity?: number;
  /** lay the text on the floor (rotation -90° about x) */
  flat?: boolean;
  /**
   * The text sits under a <ScreenSizer>, whose local unit is one pixel: default outline
   * becomes 1 px instead of 0.03 world units, which would be invisible.
   */
  screen?: boolean;
  position?: V3;
  rotation?: V3;
  visible?: boolean;
  renderOrder?: number;
  textRef?: Ref<SceneTextHandle>;
}

/**
 * In-world SDF text: local Geist Mono, glyphs restricted to SCENE_GLYPHS, dark outline for
 * legibility over geometry, colours kept exact (no tone mapping).
 */
export function SceneText({
  text,
  fontSize = 0.2,
  color = MJC.fg,
  anchorX = "center",
  anchorY = "middle",
  textAlign = "center",
  letterSpacing = 0.06,
  lineHeight = 1.25,
  maxWidth,
  outlineWidth,
  fillOpacity = 1,
  flat = false,
  screen = false,
  position,
  rotation,
  visible = true,
  renderOrder,
  textRef,
}: SceneTextProps) {
  const outline = outlineWidth ?? (screen ? 1 : 0.03);
  const rot: V3 | undefined = flat ? [-Math.PI / 2, 0, rotation?.[2] ?? 0] : rotation;
  return (
    <Text
      ref={textRef}
      font={SCENE_FONT}
      characters={SCENE_GLYPHS}
      fontSize={fontSize}
      color={color}
      anchorX={anchorX}
      anchorY={anchorY}
      textAlign={textAlign}
      letterSpacing={letterSpacing}
      lineHeight={lineHeight}
      maxWidth={maxWidth}
      outlineWidth={outline}
      outlineColor={MJC.bg}
      fillOpacity={fillOpacity}
      position={position}
      rotation={rot}
      visible={visible}
      renderOrder={renderOrder}
      material-toneMapped={false}
    >
      {text}
    </Text>
  );
}
