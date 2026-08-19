"use client";

import { useActionState, useState } from "react";
import { submitGaRequest } from "../actions";
import type { GaRequestType } from "@/generated/prisma/enums";

interface Option {
  id: string;
  label: string;
}

const REQUEST_TYPES: { value: GaRequestType; label: string }[] = [
  { value: "NEW_ASSET_NEED", label: "Kebutuhan Aset Baru" },
  { value: "DAMAGE_OR_ABNORMAL_CONDITION", label: "Kerusakan / Kondisi Tidak Normal" },
  { value: "LOSS", label: "Kehilangan" },
];

export function NewGaRequestForm({ assets, locations }: { assets: Option[]; locations: Option[] }) {
  const [error, formAction, isPending] = useActionState(submitGaRequest, undefined);
  const [requestType, setRequestType] = useState<GaRequestType>("NEW_ASSET_NEED");
  const assetRequired = requestType === "DAMAGE_OR_ABNORMAL_CONDITION" || requestType === "LOSS";

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis Permintaan</label>
        <select
          name="requestType"
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as GaRequestType)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm md:w-auto"
        >
          {REQUEST_TYPES.map((tp) => (
            <option key={tp.value} value={tp.value}>
              {tp.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">Urgensi</label>
        <select name="urgency" defaultValue="MEDIUM" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="LOW">Rendah</option>
          <option value="MEDIUM">Sedang</option>
          <option value="HIGH">Tinggi</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">
          Aset {assetRequired && "(wajib)"} {!assetRequired && "(opsional)"}
        </label>
        <select name="assetId" required={assetRequired} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih Aset —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">Lokasi (opsional)</label>
        <select name="locationId" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Tidak Ditentukan —</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">Deskripsi</label>
        <textarea name="description" required rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">Bukti / Foto (opsional)</label>
        <input name="evidenceFile" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Mengirim..." : "Kirim Permintaan"}
      </button>
    </form>
  );
}
