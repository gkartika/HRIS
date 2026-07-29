"use client";

import { useActionState } from "react";
import { createEmployeeFromRecruitmentRequest } from "../../actions";
import { t } from "@/lib/i18n/id";
import type { Position, Job, OrgUnit, EducationLevel, PtkpStatus } from "@/generated/prisma/client";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };

export function CreateEmployeeFromRequestForm({
  requestId,
  candidatePositions,
  educationLevels,
  ptkpStatuses,
}: {
  requestId: string;
  candidatePositions: PositionOption[];
  educationLevels: EducationLevel[];
  ptkpStatuses: PtkpStatus[];
}) {
  const action = createEmployeeFromRecruitmentRequest.bind(null, requestId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("recruitment.positionForNewHire")}</label>
        <select name="positionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          {candidatePositions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.positionCode} — {p.positionStatus}
            </option>
          ))}
        </select>
        {candidatePositions.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Belum ada Posisi untuk Jabatan/Department ini — buat terlebih dahulu di Pengaturan Organisasi &gt; Posisi.
          </p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.employeeNumber")}</label>
        <input name="employeeNumber" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <input name="fullLegalName" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.preferredName")}</label>
        <input name="preferredName" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.gender")}</label>
        <select name="gender" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          <option value="MALE">{t("gender.MALE")}</option>
          <option value="FEMALE">{t("gender.FEMALE")}</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.workEmail")}</label>
        <input name="workEmail" type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.mobileNumber")}</label>
        <input name="mobileNumber" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.hireDate")}</label>
        <input
          name="hireDate"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.employmentStatus")}</label>
        <select name="employmentStatus" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          <option value="PKWTT">{t("employmentStatus.PKWTT")}</option>
          <option value="PKWT">{t("employmentStatus.PKWT")}</option>
          <option value="HARIAN_LEPAS">{t("employmentStatus.HARIAN_LEPAS")}</option>
          <option value="MAGANG">{t("employmentStatus.MAGANG")}</option>
        </select>
      </div>

      <div className="md:col-span-2 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-500">Data Identitas &amp; Kependudukan</p>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">No. KK</label>
        <input name="noKk" inputMode="numeric" maxLength={16} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Ibu Kandung</label>
        <input name="namaIbuKandung" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Pendidikan Terakhir</label>
        <select name="educationLevelId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
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
        <select name="ptkpStatusCode" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          {ptkpStatuses.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} — {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-rose-600 md:col-span-2">{error}</p>}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("recruitment.createEmployeeFromRequest")}
        </button>
      </div>
    </form>
  );
}
