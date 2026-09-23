import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next build`'s bundled ESLint runner isn't compatible with this project's flat
  // config; lint is run separately via `npm run lint` (see README).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
