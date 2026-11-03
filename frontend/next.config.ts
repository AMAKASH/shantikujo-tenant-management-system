import type { NextConfig } from "next";

// The Express API always runs next to Next.js (same container in production, same machine in dev).
const API = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // Client router cache (seconds). Nav links use full prefetch, so pages and their data load in the
    // background after the current page finishes. Every mutation calls router.refresh(), which clears
    // this cache, so it only ever serves data from before changes made on another device or by the cron job.
    staleTimes: {
      dynamic: 30, // pages you visited: going back within 30 s is instant
      static: 120, // prefetched pages: reused for up to 2 minutes
    },
  },
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
