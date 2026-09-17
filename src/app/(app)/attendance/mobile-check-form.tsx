"use client";

import { useActionState, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { recordAttendanceEvent } from "./actions";
import { t } from "@/lib/i18n/id";

// Version after UAT: check-in (green, "masuk") and check-out (amber,
// "pulang") get distinct colors/icons throughout so the two are never
// confused at a glance — per direct request to make them easy to tell apart.
const TONE = {
  CHECK_IN: {
    icon: LogIn,
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    button: "bg-emerald-600 hover:bg-emerald-700",
  },
  CHECK_OUT: {
    icon: LogOut,
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    button: "bg-amber-600 hover:bg-amber-700",
  },
} as const;

export function MobileCheckForm({ eventType, label }: { eventType: "CHECK_IN" | "CHECK_OUT"; label: string }) {
  const [error, formAction, isPending] = useActionState(recordAttendanceEvent, undefined);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const tone = TONE[eventType];
  const Icon = tone.icon;

  function captureLocation() {
    if (!navigator.geolocation) {
      setLocationError(t("attendance.geolocationUnsupported"));
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError(t("attendance.locationError"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <form action={formAction} className={`space-y-3 rounded-xl border ${tone.border} ${tone.bg} p-5`}>
      <input type="hidden" name="eventType" value={eventType} />
      {coords && <input type="hidden" name="latitude" value={coords.latitude} />}
      {coords && <input type="hidden" name="longitude" value={coords.longitude} />}

      <p className={`flex items-center gap-2 text-sm font-semibold ${tone.text}`}>
        <Icon size={18} />
        {label}
      </p>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("attendance.locationLabel")}</label>
        <button
          type="button"
          onClick={captureLocation}
          disabled={locating}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {locating ? "..." : t("attendance.captureLocationButton")}
        </button>
        <p className="mt-1 text-xs text-slate-500">
          {coords
            ? `${t("attendance.locationCaptured")} (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`
            : t("attendance.locationPending")}
        </p>
        {locationError && <p className="mt-1 text-xs text-rose-600">{locationError}</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("attendance.reasonLabel")}</label>
        <textarea
          name="reason"
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !coords}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${tone.button}`}
      >
        <Icon size={16} />
        {isPending ? "Menyimpan..." : label}
      </button>
    </form>
  );
}
