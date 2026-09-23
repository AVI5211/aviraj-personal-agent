import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal production server for Docker/Cloud Run instead of copying
  // development tooling and the full node_modules tree into the final image.
  output: "standalone",
  // `next build`'s bundled ESLint runner isn't compatible with this project's flat
  // config; lint is run separately via `npm run lint` (see README).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
