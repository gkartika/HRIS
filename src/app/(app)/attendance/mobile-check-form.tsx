"use client";

import { useActionState, useState } from "react";
import { recordAttendanceEvent } from "./actions";
import { t } from "@/lib/i18n/id";

export function MobileCheckForm({ eventType, label }: { eventType: "CHECK_IN" | "CHECK_OUT"; label: string }) {
  const [error, formAction, isPending] = useActionState(recordAttendanceEvent, undefined);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

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
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="eventType" value={eventType} />
      {coords && <input type="hidden" name="latitude" value={coords.latitude} />}
      {coords && <input type="hidden" name="longitude" value={coords.longitude} />}

      <p className="text-sm font-medium text-slate-900">{label}</p>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("attendance.locationLabel")}</label>
        <button
          type="button"
          onClick={captureLocation}
          disabled={locating}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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
        <label className="mb-1 block text-xs text-slate-500">{t("attendance.selfieLabel")}</label>
        <input name="selfie" type="file" accept="image/*" capture="user" required className="text-sm" />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !coords}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : label}
      </button>
    </form>
  );
}
