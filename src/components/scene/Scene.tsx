"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, PerformanceMonitor, Preload, Sparkles, Stars } from "@react-three/drei";
import { CameraRig } from "./CameraRig";
import { Barrier, CloudSite, EnclaveSite, Hub, OnPremSite, Routes } from "./Sites";
import { DiodeGate } from "./DiodeGate";
import { Packets } from "./Packets";

export function Scene() {
  const [dpr, setDpr] = useState<number>(1.5);
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 11, 17.5], fov: 40, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#05070b", 1);
      }}
      data-testid="scene-3d"
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={2} />
      <color attach="background" args={["#05070b"]} />
      <fog attach="fog" args={["#05070b", 22, 46]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 8]} intensity={0.9} color="#cfe9ff" />
      <hemisphereLight args={["#1b2a3a", "#05070b", 0.5]} />
      <Suspense fallback={null}>
        <Stars radius={60} depth={30} count={1500} factor={2.2} saturation={0} fade speed={0.4} />
        <Sparkles count={60} scale={[26, 6, 22]} size={1.6} speed={0.25} opacity={0.35} color="#22d3ee" position={[1, 2.5, 1]} />
        <Grid position={[0, -0.01, 0]} args={[80, 80]} cellSize={1} cellThickness={0.5} cellColor="#0f2a33" sectionSize={5} sectionThickness={1} sectionColor="#155e6b" fadeDistance={42} fadeStrength={1.4} infiniteGrid />
        <Routes />
        <Hub />
        <Barrier />
        <CloudSite />
        <OnPremSite />
        <EnclaveSite />
        <DiodeGate />
        <Packets />
        <CameraRig />
        <Preload all />
      </Suspense>
    </Canvas>
  );
}

export default Scene;
