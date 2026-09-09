"use client";

import { useEffect, useRef } from "react";
import { CameraControls } from "@react-three/drei";
import { useDirector } from "@/store/director";
import { CAMERA_PRESETS } from "./layout";

export function CameraRig() {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const o = CAMERA_PRESETS.overview;
    void c.setLookAt(...o.pos, ...o.target, false);
    useDirector.getState().registerCamera(async (focus, animate) => {
      const p = CAMERA_PRESETS[focus] ?? CAMERA_PRESETS.overview;
      await c.setLookAt(...p.pos, ...p.target, animate);
    });
    return () => useDirector.getState().registerCamera(null);
  }, []);
  return <CameraControls ref={ref} makeDefault smoothTime={0.55} minDistance={5} maxDistance={32} maxPolarAngle={Math.PI / 2.05} minPolarAngle={0.25} dollyToCursor={false} />;
}
