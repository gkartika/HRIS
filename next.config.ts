import type { NextConfig } from "next";

// One id per build, baked into both the pages and /api/version: an open page compares the two to know a newer
// version of the app is live (see components/app-update-watcher.tsx).
const BUILD_ID = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
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
