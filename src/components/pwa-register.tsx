"use client";

import { useEffect } from "react";
import { startInstallListener } from "@/lib/pwa-install";

// Mounted once in the root layout: listens for the browser's install prompt and
// registers the service worker (production only, so local development is never cached).
startInstallListener();

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (registration) => {
        // Look for a newer service worker whenever the app comes back to the front (it is otherwise checked
        // only on a page load), so a new version is picked up without waiting a day.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void registration.update().catch(() => {});
        });
        // Ask the browser to refresh the number on the app icon about twice a day
        // while the app is closed (installed apps only; others refuse quietly).
        const periodic = (registration as ServiceWorkerRegistration & {
          periodicSync?: { register: (tag: string, options: { minInterval: number }) => Promise<void> };
        }).periodicSync;
        await periodic?.register("hc-pending-approvals", { minInterval: 12 * 60 * 60 * 1000 }).catch(() => {});
      })
      .catch(() => {});
  }, []);
  return null;
}
