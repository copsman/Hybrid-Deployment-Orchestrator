"use client";

import dynamic from "next/dynamic";
import { Component, useSyncExternalStore, type ReactNode } from "react";
import { useDirector } from "@/store/director";
import { Fallback2D } from "./Fallback2D";
import { Poster } from "./Poster";

const Scene = dynamic(() => import("./Scene"), { ssr: false, loading: () => <Poster /> });

let webglCache: boolean | null = null;
function webglAvailable(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}
const subscribeNoop = () => () => {};
const serverSnapshot = (): boolean | null => null;

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Scene host. Renders the 3D scene when WebGL is available and reduced motion is off,
 * otherwise the 2D map. A rendering failure inside the scene also drops to the 2D map,
 * so the control room never goes blank.
 */
export function SceneCanvas() {
  const reducedMotion = useDirector((s) => s.reducedMotion);
  // Server render and first client paint agree on "unknown"; the real answer arrives without a setState-in-effect.
  const gl = useSyncExternalStore<boolean | null>(subscribeNoop, webglAvailable, serverSnapshot);
  if (gl === null) return <Poster />;
  if (reducedMotion || !gl) return <Fallback2D />;
  return (
    <SceneBoundary fallback={<Fallback2D />}>
      <div className="absolute inset-0" data-testid="scene-3d-host">
        <Scene />
      </div>
    </SceneBoundary>
  );
}
