"use client";

import { DocumentFileInput } from "@/components/document-file-input";
import { useActionState, useState } from "react";
import { returnAssetCustody, transferAssetCustody } from "../actions";
import { t } from "@/lib/i18n/id";

interface Option {
  id: string;
}

function ReturnForm({ custodyId }: { custodyId: string }) {
  const [error, formAction, isPending] = useActionState(returnAssetCustody.bind(null, custodyId), undefined);
  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.inspectionResultLabel")}</label>
        <select name="inspectionResult" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="GOOD">{t("assetInspectionResult.GOOD")}</option>
          <option value="NEEDS_REPAIR">{t("assetInspectionResult.NEEDS_REPAIR")}</option>
          <option value="LOST_OR_BEYOND_REPAIR">{t("assetInspectionResult.LOST_OR_BEYOND_REPAIR")}</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.returnConditionNoteLabel")}</label>
        <input name="returnConditionNote" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.returnEvidenceLabel")}</label>
        <DocumentFileInput name="returnEvidenceFile" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : t("asset.returnButton")}
        </button>
      </div>
    </form>
  );
}

function TransferForm({
  custodyId,
  employees,
  orgUnits,
  locations,
}: {
  custodyId: string;
  employees: (Option & { employeeNumber: string; fullLegalName: string })[];
  orgUnits: (Option & { unitName: string })[];
  locations: (Option & { locationName: string })[];
}) {
  const [error, formAction, isPending] = useActionState(transferAssetCustody.bind(null, custodyId), undefined);
  const [newTargetType, setNewTargetType] = useState("EMPLOYEE");
  return (
    <form action={formAction} className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.transferTargetTypeLabel")}</label>
        <select
          name="newTargetType"
          value={newTargetType}
          onChange={(e) => setNewTargetType(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="EMPLOYEE">{t("assetCustodyTargetType.EMPLOYEE")}</option>
          <option value="DEPARTMENT">{t("assetCustodyTargetType.DEPARTMENT")}</option>
        </select>
      </div>
      {newTargetType === "EMPLOYEE" && (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("asset.employeeLabel")}</label>
          <select name="employeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih Karyawan —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.employeeNumber} — {e.fullLegalName}
              </option>
            ))}
          </select>
        </div>
      )}
      {newTargetType === "DEPARTMENT" && (
        <>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("asset.departmentLabel")}</label>
            <select name="orgUnitId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih Departemen —</option>
              {orgUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("asset.locationLabel")}</label>
            <select name="locationId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih Lokasi —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.locationName}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.conditionAtHandoverLabel")}</label>
        <input name="conditionAtHandover" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : t("asset.transferButton")}
        </button>
      </div>
    </form>
  );
}

export function CustodyActions({
  custodyId,
  employees,
  orgUnits,
  locations,
}: {
  custodyId: string;
  employees: (Option & { employeeNumber: string; fullLegalName: string })[];
  orgUnits: (Option & { unitName: string })[];
  locations: (Option & { locationName: string })[];
}) {
  const [open, setOpen] = useState<"NONE" | "RETURN" | "TRANSFER">("NONE");

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(open === "RETURN" ? "NONE" : "RETURN")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          {t("asset.returnTitle")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "TRANSFER" ? "NONE" : "TRANSFER")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          {t("asset.transferTitle")}
        </button>
      </div>
      {open === "RETURN" && <ReturnForm custodyId={custodyId} />}
      {open === "TRANSFER" && <TransferForm custodyId={custodyId} employees={employees} orgUnits={orgUnits} locations={locations} />}
    </div>
  );
}
