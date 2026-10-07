"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { createEmployeeFromRecruitmentRequest } from "../../actions";
import { t } from "@/lib/i18n/id";
import type { Position, Job, OrgUnit, EducationLevel, PtkpStatus } from "@/generated/prisma/client";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };

export function CreateEmployeeFromRequestForm({
  requestId,
  candidatePositions,
  educationLevels,
  ptkpStatuses,
  nextEmployeeNumber,
}: {
  requestId: string;
  candidatePositions: PositionOption[];
  educationLevels: EducationLevel[];
  ptkpStatuses: PtkpStatus[];
  nextEmployeeNumber: string;
}) {
  const action = createEmployeeFromRecruitmentRequest.bind(null, requestId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-mono">{nextEmployeeNumber}</span>
            <span className="ml-2 text-xs text-slate-400">dibuat otomatis saat disimpan</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
          <input name="fullLegalName" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.hireDate")} (opsional — kosong = hari ini)</label>
          <input
            name="hireDate"
            type="date"
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
      </div>

      <details className="group mt-5 border-t border-slate-100 pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
          <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
          Data tambahan (opsional — bisa diisi nanti)
        </summary>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("employee.gender")}</label>
            <select name="gender" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              <option value="MALE">{t("gender.MALE")}</option>
              <option value="FEMALE">{t("gender.FEMALE")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("employee.mobileNumber")}</label>
            <input name="mobileNumber" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">No. KK</label>
            <input
              name="noKk"
              inputMode="numeric"
              maxLength={16}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nama Ibu Kandung</label>
            <input name="namaIbuKandung" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Pendidikan Terakhir</label>
            <select name="educationLevelId" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
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
            <select name="ptkpStatusCode" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              {ptkpStatuses.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      <div className="mt-4">
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
