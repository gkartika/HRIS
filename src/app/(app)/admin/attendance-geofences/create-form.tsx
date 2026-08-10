"use client";

import { useActionState } from "react";
import { createGeofence } from "./actions";

export function CreateGeofenceForm() {
  const [error, formAction, isPending] = useActionState(createGeofence, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex-1">
        <label className="mb-1 block text-xs text-slate-500">Nama Lokasi</label>
        <input
          name="siteName"
          required
          placeholder="mis. Pabrik Cikarang"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Latitude</label>
        <input
          name="latitude"
          type="number"
          step="any"
          required
          className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Longitude</label>
        <input
          name="longitude"
          type="number"
          step="any"
          required
          className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Radius (meter)</label>
        <input
          name="radiusMeters"
          type="number"
          min={1}
          defaultValue={100}
          required
          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Tambah Lokasi"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
