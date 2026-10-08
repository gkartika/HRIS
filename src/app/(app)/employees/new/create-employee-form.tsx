"use client";

import { useActionState } from "react";
import { createEmployee } from "../actions";
import { t } from "@/lib/i18n/id";
import { EmployeeCoreFields, EmployeeExtraFields } from "@/components/employee-form-fields";
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
      <EmployeeCoreFields nextEmployeeNumber={nextEmployeeNumber} />
      <EmployeeExtraFields educationLevels={educationLevels} ptkpStatuses={ptkpStatuses} />

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
