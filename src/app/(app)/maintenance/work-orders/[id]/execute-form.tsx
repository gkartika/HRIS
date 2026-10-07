"use client";

import { DocumentFileInput } from "@/components/document-file-input";
import { useActionState } from "react";
import { executeMaintenanceWorkOrder } from "../../actions";

export function ExecuteMaintenanceForm({ workOrderId }: { workOrderId: string }) {
  const [error, formAction, isPending] = useActionState(executeMaintenanceWorkOrder.bind(null, workOrderId), undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-2">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tanggal Servis</label>
        <input name="serviceDate" type="date" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">KM (opsional)</label>
        <input name="odometerKm" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Diagnosis</label>
        <textarea name="diagnosisNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Tindakan yang Dilakukan (wajib)</label>
        <textarea name="actionTakenNote" required rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Biaya (opsional)</label>
        <input name="cost" type="number" min={0} step="0.01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Bukti</label>
        <DocumentFileInput name="evidenceFile" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Hasil</label>
        <select name="outcome" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="OPERATIONAL">Operasional (kembali normal)</option>
          <option value="BEYOND_REPAIR">Tidak Dapat Diperbaiki (disposal)</option>
        </select>
      </div>
      <div />
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jatuh Tempo Berikutnya (opsional)</label>
        <input name="nextDueDate" type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">KM Berikutnya (opsional)</label>
        <input name="nextDueKm" type="number" min={0} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Selesaikan Perawatan"}
        </button>
      </div>
    </form>
  );
}
