"use client";

import { ReasonForm } from "@/components/reason-form";
import { DocumentFileInput } from "@/components/document-file-input";
import { useActionState, useState } from "react";
import {
  verifyGaRequest,
  decideGaRequestAsApprover,
  processGaRequest,
  reviewGaRequestLoss,
  cancelGaRequest,
} from "../actions";
import { t } from "@/lib/i18n/id";

export function VerifyForm({ requestId, needsEvidence }: { requestId: string; needsEvidence: boolean }) {
  const [error, formAction, isPending] = useActionState(verifyGaRequest.bind(null, requestId), undefined);
  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-500">Catatan Verifikasi</label>
      <textarea name="verificationNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {needsEvidence && (
        <>
          <label className="block text-xs text-slate-500">Bukti Kehilangan (jika belum ada)</label>
          <DocumentFileInput name="evidenceFile" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
        </>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : "Verifikasi & Rutekan"}
      </button>
    </form>
  );
}

export function ApproverDecisionButtons({ requestId }: { requestId: string }) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const action = decideGaRequestAsApprover.bind(null, requestId, decision ?? "APPROVE");
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!decision) {
    return (
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setDecision("APPROVE")}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
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
      <label className="block text-xs text-slate-500">
        Catatan {decision === "REJECT" && "(wajib)"}
      </label>
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

interface EmployeeOption {
  id: string;
  label: string;
}
interface AssetOption {
  id: string;
  label: string;
  trackingType: string;
  availableQuantity: number | null;
}

export function ProcessForm({
  requestId,
  assets,
  employees,
  orgUnits,
  locations,
  defaultEmployeeId,
}: {
  requestId: string;
  assets: AssetOption[];
  employees: EmployeeOption[];
  orgUnits: EmployeeOption[];
  locations: EmployeeOption[];
  defaultEmployeeId: string;
}) {
  const [mode, setMode] = useState<"ALLOCATE" | "PROCUREMENT">("ALLOCATE");
  const [targetType, setTargetType] = useState<"EMPLOYEE" | "DEPARTMENT" | "LOCATION">("EMPLOYEE");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [error, formAction, isPending] = useActionState(processGaRequest.bind(null, requestId), undefined);
  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="processingMode" value={mode} />
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setMode("ALLOCATE")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "ALLOCATE" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
        >
          Alokasikan Aset Tersedia
        </button>
        <button
          type="button"
          onClick={() => setMode("PROCUREMENT")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === "PROCUREMENT" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
        >
          Referensi Pengadaan
        </button>
      </div>

      {mode === "PROCUREMENT" ? (
        <div>
          <label className="mb-1 block text-xs text-slate-500">Referensi Pengadaan (wajib)</label>
          <input name="procurementReference" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Aset yang Dialokasikan</label>
            <select
              name="allocateAssetId"
              required
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Pilih Aset —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {(["EMPLOYEE", "DEPARTMENT", "LOCATION"] as const).map((tt) => (
              <button
                key={tt}
                type="button"
                onClick={() => setTargetType(tt)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${targetType === tt ? "bg-slate-700 text-white" : "border border-slate-200 text-slate-600"}`}
              >
                {tt === "EMPLOYEE" ? "Karyawan" : tt === "DEPARTMENT" ? "Departemen" : "Lokasi"}
              </button>
            ))}
          </div>
          <input type="hidden" name="targetType" value={targetType} />

          {targetType === "EMPLOYEE" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Karyawan Tujuan</label>
              <select name="employeeId" required defaultValue={defaultEmployeeId} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Pilih Karyawan —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {targetType === "DEPARTMENT" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Departemen Tujuan</label>
              <select name="orgUnitId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Pilih Departemen —</option>
                {orgUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {targetType === "LOCATION" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Lokasi Tujuan</label>
              <select name="locationId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Pilih Lokasi —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedAsset?.trackingType === "QUANTITY_TRACKED" && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Jumlah</label>
              <input
                name="quantity"
                type="number"
                min={1}
                max={selectedAsset.availableQuantity ?? undefined}
                defaultValue={1}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-slate-500">Kondisi Saat Serah Terima</label>
            <input name="conditionAtHandover" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Bukti Serah Terima</label>
            <DocumentFileInput name="handoverEvidenceFile" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
          </div>
        </>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : "Proses Permintaan"}
      </button>
    </form>
  );
}

export function LossReviewButtons({ requestId }: { requestId: string }) {
  const [decision, setDecision] = useState<"CONFIRM" | "NOT_CONFIRM" | null>(null);
  const action = reviewGaRequestLoss.bind(null, requestId, decision ?? "CONFIRM");
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!decision) {
    return (
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setDecision("CONFIRM")}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          Konfirmasi Kehilangan
        </button>
        <button
          onClick={() => setDecision("NOT_CONFIRM")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Tidak Dikonfirmasi
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-500">Catatan Peninjauan</label>
      <textarea name="lossReviewNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : decision === "CONFIRM" ? "Konfirmasi Kehilangan" : "Tidak Dikonfirmasi"}
        </button>
        <button type="button" onClick={() => setDecision(null)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function CancelRequestForm({ requestId }: { requestId: string }) {
  return (
    <ReasonForm
      action={cancelGaRequest.bind(null, requestId)}
      triggerLabel="Batalkan Permintaan"
      reasonLabel="Alasan Pembatalan"
    />
  );
}
