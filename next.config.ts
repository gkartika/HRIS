import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads (BPJS cards, evidence photos/PDFs) arrive as server-action form
    // posts. The default cap is 1 MB; the hosting platform's own cap is ~4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
