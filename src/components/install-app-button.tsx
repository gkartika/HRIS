"use client";

import { useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { getInstallState, promptInstall, subscribeInstall } from "@/lib/pwa-install";

// "Pasang sebagai aplikasi": shows only when the browser can install the app and
// it is not installed yet. `tone` picks colours for a light page or the purple sidebar.
export function InstallAppButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const state = useSyncExternalStore(subscribeInstall, getInstallState, () => "hidden" as const);
  const [showSteps, setShowSteps] = useState(false);
  if (state === "hidden") return null;

  const button =
    tone === "dark"
      ? "text-white/80 hover:text-white"
      : "text-brand hover:underline";
  const steps = tone === "dark" ? "text-white/70" : "text-[#6a5f72]";

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => (state === "prompt" ? void promptInstall() : setShowSteps((v) => !v))}
        className={`flex items-center gap-1.5 text-xs font-semibold ${button}`}
      >
        <Download size={13} />
        Pasang sebagai aplikasi
      </button>
      {state === "ios" && showSteps && (
        <p className={`mt-1.5 text-xs leading-relaxed ${steps}`}>
          Di Safari, ketuk tombol Bagikan (kotak dengan panah ke atas), lalu pilih &quot;Tambah ke Layar Utama&quot;.
        </p>
      )}
    </div>
  );
}
