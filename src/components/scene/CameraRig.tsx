"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { useDirector } from "@/store/director";
import type { Focus } from "@/engine/scenario";
import { CAMERA_PRESETS, overviewPose } from "./layout";

/**
 * Drives the camera for the director. Presets are fixed except the overview, which is
 * solved from the live frame aspect and height so the whole gradient fits and the hub
 * headline clears the caption box in the default, jury and stacked layouts.
 */
export function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const sizeRef = useRef(size);
  const applied = useRef(false);

  useEffect(() => {
    sizeRef.current = size;
    const c = ref.current;
    if (!c) return;
    const o = overviewPose(size.width / size.height, size.height);
    if (!applied.current) {
      applied.current = true;
      void c.setLookAt(...o.pos, ...o.target, false);
      return;
    }
    if (useDirector.getState().focus === "overview") void c.setLookAt(...o.pos, ...o.target, true);
  }, [size]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const poseFor = (focus: Focus) => {
      if (focus === "overview") {
        const s = sizeRef.current;
        return overviewPose(s.width / s.height, s.height);
      }
      return CAMERA_PRESETS[focus] ?? CAMERA_PRESETS.overview;
    };
    useDirector.getState().registerCamera(async (focus, animate) => {
      const p = poseFor(focus);
      await c.setLookAt(...p.pos, ...p.target, animate);
    });
    return () => useDirector.getState().registerCamera(null);
  }, []);

  return <CameraControls ref={ref} makeDefault smoothTime={0.55} minDistance={4} maxDistance={60} maxPolarAngle={Math.PI / 2.05} minPolarAngle={0.2} dollyToCursor={false} />;
}
