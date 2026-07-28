"use client";

import { useActionState } from "react";
import { createEmployee } from "../actions";
import { t } from "@/lib/i18n/id";

export function CreateEmployeeForm() {
  const [error, formAction, isPending] = useActionState(createEmployee, undefined);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2"
    >
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.employeeNumber")}</label>
        <input
          name="employeeNumber"
          required
          placeholder="CBP-0003"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
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
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("employee.employmentStatus")}</label>
        <select
          name="employmentStatus"
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Pilih —</option>
          <option value="PKWTT">{t("employmentStatus.PKWTT")}</option>
          <option value="PKWT">{t("employmentStatus.PKWT")}</option>
          <option value="HARIAN_LEPAS">{t("employmentStatus.HARIAN_LEPAS")}</option>
          <option value="MAGANG">{t("employmentStatus.MAGANG")}</option>
        </select>
      </div>
      <p className="text-xs text-slate-400 md:col-span-2">
        Setelah karyawan dibuat, tambahkan Penempatan (Posisi Utama) dari halaman detail karyawan.
      </p>
      {error && <p className="text-xs text-rose-600 md:col-span-2">{error}</p>}
      <div className="md:col-span-2">
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
