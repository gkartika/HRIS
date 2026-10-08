"use client";

import { useActionState } from "react";
import { confirmGaAssetClearance } from "../actions";
import { t } from "@/lib/i18n/id";

export interface ClearanceCustody {
  id: string;
  assetName: string;
  assetCode: string;
}

export function ConfirmGaAssetClearanceForm({ caseId, custodies }: { caseId: string; custodies: ClearanceCustody[] }) {
  const action = confirmGaAssetClearance.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      {custodies.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Kondisi Saat Dikembalikan</p>
          {custodies.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="text-sm text-slate-700">
                {c.assetName} <span className="text-xs text-slate-400">({c.assetCode})</span>
              </span>
              <select
                name={`inspectionResult-${c.id}`}
                required
                defaultValue="GOOD"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              >
                <option value="GOOD">{t("assetInspectionResult.GOOD")}</option>
                <option value="NEEDS_REPAIR">{t("assetInspectionResult.NEEDS_REPAIR")}</option>
                <option value="BEYOND_REPAIR">Rusak berat (tidak bisa diperbaiki)</option>
                <option value="LOST">Hilang</option>
              </select>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Aset yang hilang atau rusak berat tidak langsung dihapus: sistem membuatkan usulan penghapusan (Draft) yang
            masih perlu diajukan dan disetujui di menu Disposal.
          </p>
        </div>
      )}
      <div>
        <label className="block text-xs text-slate-500">Catatan (opsional)</label>
        <textarea
          name="gaAssetClearanceNote"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isPending ? "Memproses..." : "Konfirmasi & Kembalikan Aset"}
      </button>
    </form>
  );
}
