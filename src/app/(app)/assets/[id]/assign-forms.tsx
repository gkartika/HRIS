"use client";

import { useActionState, useState } from "react";
import { assignAssetToEmployee, assignAssetToDepartment, assignAssetToLocation } from "../actions";
import { t } from "@/lib/i18n/id";

interface Option {
  id: string;
}

type Tab = "EMPLOYEE" | "DEPARTMENT" | "LOCATION";

function QuantityField({ trackingType, availableQuantity }: { trackingType: string; availableQuantity: number }) {
  if (trackingType !== "QUANTITY_TRACKED") return null;
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{t("asset.quantity")}</label>
      <input
        name="quantity"
        type="number"
        min={1}
        max={availableQuantity}
        defaultValue={1}
        required
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
    </div>
  );
}

function EmployeeForm({
  assetId,
  trackingType,
  availableQuantity,
  employees,
}: {
  assetId: string;
  trackingType: string;
  availableQuantity: number;
  employees: (Option & { employeeNumber: string; fullLegalName: string })[];
}) {
  const [error, formAction, isPending] = useActionState(assignAssetToEmployee.bind(null, assetId), undefined);
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{error}</p>}
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
      <QuantityField trackingType={trackingType} availableQuantity={availableQuantity} />
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.conditionAtHandoverLabel")}</label>
        <input name="conditionAtHandover" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.handoverEvidenceLabel")}</label>
        <input name="handoverEvidenceFile" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : t("asset.assignButton")}
        </button>
      </div>
    </form>
  );
}

function DepartmentForm({
  assetId,
  trackingType,
  availableQuantity,
  orgUnits,
}: {
  assetId: string;
  trackingType: string;
  availableQuantity: number;
  orgUnits: (Option & { unitName: string })[];
}) {
  const [error, formAction, isPending] = useActionState(assignAssetToDepartment.bind(null, assetId), undefined);
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{error}</p>}
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
      <QuantityField trackingType={trackingType} availableQuantity={availableQuantity} />
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.conditionAtHandoverLabel")}</label>
        <input name="conditionAtHandover" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.handoverEvidenceLabel")}</label>
        <input name="handoverEvidenceFile" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : t("asset.assignButton")}
        </button>
      </div>
    </form>
  );
}

function LocationForm({
  assetId,
  trackingType,
  availableQuantity,
  locations,
}: {
  assetId: string;
  trackingType: string;
  availableQuantity: number;
  locations: (Option & { locationName: string })[];
}) {
  const [error, formAction, isPending] = useActionState(assignAssetToLocation.bind(null, assetId), undefined);
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 md:col-span-4">{error}</p>}
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
      <QuantityField trackingType={trackingType} availableQuantity={availableQuantity} />
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.conditionAtHandoverLabel")}</label>
        <input name="conditionAtHandover" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("asset.handoverEvidenceLabel")}</label>
        <input name="handoverEvidenceFile" type="file" accept=".pdf,.jpg,.jpeg,.png" className="text-sm" />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : t("asset.assignButton")}
        </button>
      </div>
    </form>
  );
}

export function AssignForms({
  assetId,
  trackingType,
  availableQuantity,
  employees,
  orgUnits,
  locations,
}: {
  assetId: string;
  trackingType: string;
  availableQuantity: number;
  employees: (Option & { employeeNumber: string; fullLegalName: string })[];
  orgUnits: (Option & { unitName: string })[];
  locations: (Option & { locationName: string })[];
}) {
  const [tab, setTab] = useState<Tab>("EMPLOYEE");
  const tabs: { key: Tab; label: string }[] = [
    { key: "EMPLOYEE", label: t("asset.assignToEmployeeTitle") },
    { key: "DEPARTMENT", label: t("asset.assignToDepartmentTitle") },
    { key: "LOCATION", label: t("asset.assignToLocationTitle") },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex gap-2 border-b border-slate-100">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === tb.key ? "border-indigo-600 font-medium text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>
      {tab === "EMPLOYEE" && (
        <EmployeeForm assetId={assetId} trackingType={trackingType} availableQuantity={availableQuantity} employees={employees} />
      )}
      {tab === "DEPARTMENT" && (
        <DepartmentForm assetId={assetId} trackingType={trackingType} availableQuantity={availableQuantity} orgUnits={orgUnits} />
      )}
      {tab === "LOCATION" && (
        <LocationForm assetId={assetId} trackingType={trackingType} availableQuantity={availableQuantity} locations={locations} />
      )}
    </div>
  );
}
