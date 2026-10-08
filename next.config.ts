import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads (BPJS cards, evidence photos/PDFs) arrive as server-action form
    // posts. The default cap is 1 MB; the hosting platform's own cap is ~4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [
      {
        // The browser must re-check the service worker on every visit so updates are never stuck.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
