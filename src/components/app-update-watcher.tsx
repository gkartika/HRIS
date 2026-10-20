"use client";

import { useEffect, useRef, useState } from "react";
import { UPDATE_CHECK_INTERVAL_MS, updateAction } from "@/lib/app-update";
import { t } from "@/lib/i18n/id";

// Mounted once in the root layout. When a new version of SAPA goes live, everyone who has the app open (in a
// browser tab or as the installed app) gets it: a tab nobody is looking at refreshes itself, and a tab someone is
// using shows a small "Muat ulang" notice instead of pulling the page away mid-typing. Installed apps also pick
// up the new version the next time they are opened, because pages always come live from the server.
const MY_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const RELOADED_KEY = "sapa-reloaded-for";

// True when a field on the page has been changed and not saved yet.
function hasUnsavedInput(): boolean {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=password]):not([type=file]), textarea, select"
  );
  for (const el of fields) {
    if (el instanceof HTMLSelectElement) {
      if (Array.from(el.options).some((o) => o.selected !== o.defaultSelected)) return true;
    } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      if (el.checked !== el.defaultChecked) return true;
    } else if (el.value !== el.defaultValue) return true;
  }
  return false;
}

function readReloadedFor(): string | null {
  try {
    return window.sessionStorage.getItem(RELOADED_KEY);
  } catch {
    return null;
  }
}

export function AppUpdateWatcher() {
  const [outdated, setOutdated] = useState(false);
  const liveRef = useRef<string>("");

  useEffect(() => {
    // Not while developing: every restart would count as a "new version".
    if (process.env.NODE_ENV !== "production" || !MY_BUILD) return;

    function reload() {
      try {
        window.sessionStorage.setItem(RELOADED_KEY, liveRef.current);
      } catch {
        // storage blocked: the notice is shown instead of a second automatic reload
      }
      window.location.reload();
    }

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        liveRef.current = build ?? "";
        const action = updateAction({ mine: MY_BUILD, live: liveRef.current, visible: document.visibilityState === "visible", alreadyReloadedFor: readReloadedFor() });
        if (action === "reload" && !hasUnsavedInput()) reload();
        else if (action !== "none") setOutdated(true);
      } catch {
        // offline: try again later
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void check();
      // the person leaves while a notice is waiting: refresh now, they will come back to the new version
      else if (liveRef.current && liveRef.current !== MY_BUILD && readReloadedFor() !== liveRef.current && !hasUnsavedInput()) reload();
    }

    void check();
    const timer = window.setInterval(check, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!outdated) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-[#3d1f40] px-4 py-3 text-sm text-white shadow-lg">
      <p className="min-w-0 flex-1">{t("app.update.message")}</p>
      <button type="button" onClick={() => window.location.reload()} className="shrink-0 rounded-full bg-brand-accent px-4 py-1.5 text-xs font-bold text-[#3d1f40] hover:opacity-90">
        {t("app.update.button")}
      </button>
    </div>
  );
}
