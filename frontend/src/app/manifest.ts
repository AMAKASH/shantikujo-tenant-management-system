import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "STMS: Shantikunjo Tenant Management System",
    short_name: "STMS",
    description: "Manage tenants, apartments, rent and bills.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7F9FC",
    theme_color: "#0B2D6B",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tenants", url: "/tenants", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Billing", url: "/billing", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Meter readings", url: "/billing/meter-readings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
