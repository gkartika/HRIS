"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { appBadgeSupported, showAppBadge } from "@/lib/app-badge";
import { getPendingState, getServerPendingState, setPendingState, subscribePending } from "@/lib/pending-count-store";
import { titleWithCount, type NotificationPrefs } from "@/lib/notification-prefs";

const REFRESH_MS = 5 * 60 * 1000;
// Moving between pages does not ask the server again within this time (the
// Beranda always does, since that is where approvals get decided).
const MIN_GAP_MS = 30 * 1000;

// Keeps the number of waiting approvals up to date and shows it where this
// person asked for it: on the installed app's icon, next to Beranda in the
// side menu (see sidebar-nav.tsx) and in the browser tab title. Refreshes on
// page changes, when the window comes back into view, and every 5 minutes.
// Mounted once in the signed-in layout.
export function AppBadgeSync() {
  const pathname = usePathname();
  const pending = useSyncExternalStore(subscribePending, getPendingState, getServerPendingState);
  const lastFetch = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      lastFetch.current = Date.now();
      try {
        const res = await fetch("/api/pending-count", { cache: "no-store", credentials: "same-origin" });
        if (cancelled) return;
        if (!res.ok) return setPendingState({ count: 0 });
        const { count, prefs } = (await res.json()) as { count: number; prefs?: NotificationPrefs };
        if (!cancelled) setPendingState({ count, ...prefs });
      } catch {
        // Offline: leave the number as it was.
      }
    }

    if (pathname === "/dashboard" || Date.now() - lastFetch.current >= MIN_GAP_MS) void refresh();
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => document.visibilityState === "visible" && void refresh(), REFRESH_MS);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [pathname]);

  // The number on the app icon (installed apps only).
  useEffect(() => {
    if (appBadgeSupported()) void showAppBadge(pending.icon ? pending.count : 0);
  }, [pending.count, pending.icon]);

  // The number in the browser tab title. Next.js rewrites the title on page
  // changes, so it is put back whenever that happens.
  useEffect(() => {
    const apply = () => {
      const next = titleWithCount(document.title, pending.count, pending.tab);
      if (next !== document.title) document.title = next;
    };
    apply();
    const el = document.querySelector("title");
    if (!el) return;
    const observer = new MutationObserver(apply);
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [pending.count, pending.tab]);

  return null;
}
