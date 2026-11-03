import type { NextConfig } from "next";

// The Express API always runs next to Next.js (same container in production, same machine in dev).
const API = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        // The service worker must always be re-checked so updates roll out promptly.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async rewrites() {
    // The browser only talks to Next.js; /api/* is proxied to Express, so there's one origin and no CORS.
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default nextConfig;
