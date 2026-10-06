"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { createEmployee } from "../actions";
import { t } from "@/lib/i18n/id";
import type { EducationLevel, PtkpStatus } from "@/generated/prisma/client";

export function CreateEmployeeForm({
  educationLevels,
  ptkpStatuses,
  nextEmployeeNumber,
}: {
  educationLevels: EducationLevel[];
  ptkpStatuses: PtkpStatus[];
  nextEmployeeNumber: string;
}) {
  const [error, formAction, isPending] = useActionState(createEmployee, undefined);

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-6">
      {/* Only what's actually required to create the record — everything else
          (contact, identity, pendidikan/PTKP) is filled in later from the
          employee's own detail page, so it's tucked behind the disclosure
          below instead of crowding the form every time. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <label className="mb-1 block text-xs text-slate-500">{t("employee.hireDate")}</label>
          <input
            name="hireDate"
            type="date"
            required
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
            <label className="mb-1 block text-xs text-slate-500">No. KTP (NIK)</label>
            <input
              name="nationalIdNumber"
              inputMode="numeric"
              maxLength={16}
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
              placeholder="16 digit angka"
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

      <p className="mt-4 text-xs text-slate-400">
        Data yang tidak diisi di sini bisa dilengkapi belakangan dari halaman detail karyawan (Ubah Data). Setelah
        karyawan dibuat, unggah Kartu BPJS dan tambahkan Penempatan (Posisi Utama) juga dari sana.
      </p>
      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      <div className="mt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("employee.addEmployee")}
        </button>
      </div>
    </form>
  );
}
