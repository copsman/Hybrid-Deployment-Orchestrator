"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, PerformanceMonitor, Preload, Stars } from "@react-three/drei";
import { MJC } from "@/lib/palette";
import { CAMERA_FOV, CAMERA_PRESETS } from "./layout";
import { CameraRig } from "./CameraRig";
import { Zones } from "./Zones";
import { Routes } from "./Routes";
import { Barrier, Bench, Hub } from "./Hub";
import { Ledger } from "./Ledger";
import { Site } from "./Site";
import { DiodeGate } from "./DiodeGate";
import { ArtefactFlow } from "./ArtefactFlow";
import { Packets } from "./Packets";
import { StatsProbe, statsRequested } from "./StatsProbe";

export function Scene() {
  const [dpr, setDpr] = useState<number>(1.5);
  const [stats] = useState(statsRequested);
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: CAMERA_PRESETS.overview.pos, fov: CAMERA_FOV, near: 0.1, far: 140 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(MJC.bg, 1);
      }}
      data-testid="scene-3d"
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={2} />
      <color attach="background" args={[MJC.bg]} />
      <fog attach="fog" args={[MJC.bg, 60, 110]} />
      <ambientLight intensity={0.3} />
      <hemisphereLight args={["#1b2a3a", MJC.bg, 0.55]} />
      <directionalLight position={[8, 16, 10]} intensity={0.8} color="#cfe9ff" />
      <Suspense fallback={null}>
        <Stars radius={90} depth={40} count={1200} factor={2.2} saturation={0} fade speed={0.3} />
        <Grid position={[0, -0.01, 0]} args={[120, 120]} cellSize={1} cellThickness={0.5} cellColor="#0f2a33" sectionSize={5} sectionThickness={1} sectionColor="#155e6b" fadeDistance={70} fadeStrength={1.4} infiniteGrid />
        <Zones />
        <Routes />
        <Hub />
        <Bench />
        <Barrier />
        <Ledger />
        <Site id="cloud" />
        <Site id="onprem" />
        <Site id="airgapped" />
        <DiodeGate />
        <ArtefactFlow />
        <Packets />
        <CameraRig />
        {stats && <StatsProbe />}
        <Preload all />
      </Suspense>
    </Canvas>
  );
}

export default Scene;
