"use client";

import { useActionState } from "react";
import { toggleGeofence } from "./actions";

export function ToggleActiveForm({ geofenceId, currentActive }: { geofenceId: string; currentActive: boolean }) {
  const action = toggleGeofence.bind(null, geofenceId);
  const [, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="activeFlag" value={currentActive ? "" : "on"} />
      <button type="submit" disabled={isPending} className="text-xs text-indigo-600 hover:underline disabled:opacity-60">
        {currentActive ? "Nonaktifkan" : "Aktifkan"}
      </button>
    </form>
  );
}
