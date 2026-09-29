"use client";

import { useActionState } from "react";
import { updateEmployee } from "../../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, EducationLevel, PtkpStatus } from "@/generated/prisma/client";

export function EditEmployeeForm({
  employee,
  canEditLegalName,
  educationLevels,
  ptkpStatuses,
}: {
  employee: Employee;
  canEditLegalName: boolean;
  educationLevels: EducationLevel[];
  ptkpStatuses: PtkpStatus[];
}) {
  const action = updateEmployee.bind(null, employee.id);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <input
          name="fullLegalName"
          required
          defaultValue={employee.fullLegalName}
          disabled={!canEditLegalName}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.personalEmail")}</label>
        <input
          name="personalEmail"
          type="email"
          defaultValue={employee.personalEmail ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.mobileNumber")}</label>
        <input
          name="mobileNumber"
          defaultValue={employee.mobileNumber ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.currentAddress")}</label>
        <textarea
          name="currentAddress"
          rows={2}
          defaultValue={employee.currentAddress ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Kontak Darurat — Nama</label>
          <input
            name="emergencyContactName"
            defaultValue={employee.emergencyContactName ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Hubungan</label>
          <input
            name="emergencyContactRelation"
            defaultValue={employee.emergencyContactRelation ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Nomor Telepon</label>
          <input
            name="emergencyContactPhone"
            defaultValue={employee.emergencyContactPhone ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {canEditLegalName && (
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-medium text-slate-500">Data Identitas &amp; Kependudukan</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-slate-500">No. KTP (NIK)</label>
              <input
                name="nationalIdNumber"
                inputMode="numeric"
                maxLength={16}
                defaultValue={employee.nationalIdNumber ?? ""}
                placeholder="16 digit angka"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">No. KK</label>
              <input
                name="noKk"
                inputMode="numeric"
                maxLength={16}
                defaultValue={employee.noKk ?? ""}
                placeholder="16 digit angka"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Nama Ibu Kandung</label>
              <input
                name="namaIbuKandung"
                defaultValue={employee.namaIbuKandung ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Pendidikan Terakhir</label>
              <select
                name="educationLevelId"
                defaultValue={employee.educationLevelId ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Pilih —</option>
                {educationLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">PTKP Pajak</label>
              <select
                name="ptkpStatusCode"
                defaultValue={employee.ptkpStatusCode ?? ""}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Pilih —</option>
                {ptkpStatuses.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("common.save")}
      </button>
    </form>
  );
}
