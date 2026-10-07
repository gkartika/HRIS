"use client";

import { DocumentFileInput } from "@/components/document-file-input";
import { useActionState, useState } from "react";
import { submitDisposalCaseForApproval, decideDisposalCase, executeDisposalCase } from "../actions";
import { t } from "@/lib/i18n/id";

export function SubmitForApprovalForm({ caseId }: { caseId: string }) {
  const [error, formAction, isPending] = useActionState(submitDisposalCaseForApproval.bind(null, caseId), undefined);
  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-500">Catatan Proposal</label>
      <textarea name="proposalNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      <label className="block text-xs text-slate-500">Bukti Proposal</label>
      <DocumentFileInput name="proposalEvidenceFile" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : "Ajukan untuk Persetujuan"}
      </button>
    </form>
  );
}

export function DisposalDecisionButtons({ caseId }: { caseId: string }) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const action = decideDisposalCase.bind(null, caseId, decision ?? "APPROVE");
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!decision) {
    return (
      <div className="mt-3 flex gap-2">
        <button onClick={() => setDecision("APPROVE")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Setujui
        </button>
        <button
          onClick={() => setDecision("REJECT")}
          className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
        >
          Tolak
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-500">Catatan {decision === "REJECT" && "(wajib)"}</label>
      <textarea name="decisionNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
            decision === "APPROVE" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {isPending ? t("common.loading") : decision === "APPROVE" ? "Setujui" : "Tolak"}
        </button>
        <button type="button" onClick={() => setDecision(null)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function ExecuteDisposalForm({ caseId }: { caseId: string }) {
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
          {isPending ? t("common.loading") : "Laksanakan Disposal"}
        </button>
      </div>
    </form>
  );
}
