import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // StrictMode double-mounts in dev, which can drop the WebGL context of the
  // react-three-fiber canvas. Production behaviour is unaffected either way.
  reactStrictMode: false,
  poweredByHeader: false,
};

export default nextConfig;
