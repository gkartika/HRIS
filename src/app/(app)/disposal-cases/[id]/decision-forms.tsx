"use client";

import { DocumentFileInput } from "@/components/document-file-input";
import { useActionState } from "react";
import { executeDisposalCase, cancelDisposalCase } from "../actions";
import { ReasonForm } from "@/components/reason-form";
import { t } from "@/lib/i18n/id";

// One step: approving a disposal and taking the asset out are the same action.
export function ExecuteDisposalForm({ caseId, alreadyApproved = false }: { caseId: string; alreadyApproved?: boolean }) {
  const [error, formAction, isPending] = useActionState(executeDisposalCase.bind(null, caseId), undefined);
  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-2">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Metode</label>
        <select name="executionMethod" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="RETIRE">Retire</option>
          <option value="DISPOSE">Dispose</option>
          <option value="SELL_AS_SCRAP">Jual sebagai Scrap</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tanggal Pelaksanaan</label>
        <input name="executionDate" type="date" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nilai (opsional)</label>
        <input name="executionValue" type="number" min={0} step="0.01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Referensi (opsional)</label>
        <input name="executionReference" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      {!alreadyApproved && (
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-slate-500">Catatan persetujuan (opsional)</label>
          <input name="decisionNote" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      )}
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Bukti Pelaksanaan (wajib)</label>
        <DocumentFileInput name="executionEvidenceFile" accept=".pdf,.jpg,.jpeg,.png" required className="text-sm" />
      </div>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : alreadyApproved ? "Laksanakan Disposal" : "Setujui dan keluarkan aset"}
        </button>
      </div>
    </form>
  );
}

export function CancelDisposalForm({ caseId }: { caseId: string }) {
  return (
    <ReasonForm
      action={cancelDisposalCase.bind(null, caseId)}
      triggerLabel="Batalkan kasus, aset kembali dipakai"
      reasonLabel="Alasan pembatalan"
      fieldName="decisionNote"
      required
    />
  );
}
