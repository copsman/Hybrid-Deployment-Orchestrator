import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // StrictMode double-mounts in dev, which can drop the WebGL context of the
  // react-three-fiber canvas. Production behaviour is unaffected either way.
  reactStrictMode: false,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker runtime image (only the
  // traced node_modules subset ships, no full npm install in the final stage).
  output: "standalone",
};

export default nextConfig;
