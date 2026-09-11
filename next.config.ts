import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // StrictMode double-mounts in dev, which can drop the WebGL context of the
  // react-three-fiber canvas. Production behaviour is unaffected either way.
  reactStrictMode: false,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker runtime image (only the
  // traced node_modules subset ships, no full npm install in the final stage).
  // Vercel packages the build itself and its builder does not produce the
  // `.next/next-server.js.nft.json` trace that standalone output copies from,
  // so `next build` fails there with ENOENT. Vercel sets VERCEL=1 during the
  // build; leave the output mode at its default on that platform only.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
