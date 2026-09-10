"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Development aid, mounted only for `?stats=1` in non-production builds: logs the
 * renderer's draw-call and triangle counts every two seconds so the idle overview can be
 * kept under budget without a profiler.
 */
export function StatsProbe() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const id = setInterval(() => {
      const r = gl.info.render;
      console.debug(`[scene] draw calls ${r.calls} · triangles ${r.triangles} · programs ${gl.info.programs?.length ?? 0} · geometries ${gl.info.memory.geometries} · textures ${gl.info.memory.textures}`);
    }, 2000);
    return () => clearInterval(id);
  }, [gl]);
  return null;
}

export function statsRequested(): boolean {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("stats") === "1";
  } catch {
    return false;
  }
}
