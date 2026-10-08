"use client";

import { useEffect } from "react";
import { startInstallListener } from "@/lib/pwa-install";

// Mounted once in the root layout: listens for the browser's install prompt and
// registers the service worker (production only, so local development is never cached).
startInstallListener();

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
