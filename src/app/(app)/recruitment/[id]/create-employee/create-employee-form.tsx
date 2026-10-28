"use client";

import { useActionState } from "react";
import { createEmployeeFromRecruitmentRequest } from "../../actions";
import { t } from "@/lib/i18n/id";
import { EmployeeCoreFields, EmployeeExtraFields } from "@/components/employee-form-fields";
import type { Position, Job, OrgUnit, EducationLevel, PtkpStatus } from "@/generated/prisma/client";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit; leavingLabel?: string | null };

export function CreateEmployeeFromRequestForm({
  requestId,
  candidatePositions,
  educationLevels,
  ptkpStatuses,
  nextEmployeeNumber,
  candidate,
}: {
  requestId: string;
  /** The applicant this employee is created from (name and WhatsApp number are filled in). */
  candidate?: { id: string; fullName: string; mobileNumber: string | null } | null;
  candidatePositions: PositionOption[];
  educationLevels: EducationLevel[];
  ptkpStatuses: PtkpStatus[];
  nextEmployeeNumber: string;
}) {
  const action = createEmployeeFromRecruitmentRequest.bind(null, requestId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="rounded-xl border border-slate-200 bg-white p-6">
      {candidate && <input type="hidden" name="candidateId" value={candidate.id} />}
      <EmployeeCoreFields
        fullLegalNameDefault={candidate?.fullName}
        nextEmployeeNumber={nextEmployeeNumber}
        hireDateHint="(opsional — kosong = hari ini)"
        hireDateDefault={new Date().toISOString().slice(0, 10)}
        leading={
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.positionForNewHire")}</label>
            <select name="positionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              {candidatePositions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.positionCode} — {p.orgUnit.unitName}
                  {p.leavingLabel ? ` · ${p.leavingLabel}` : ""}
                </option>
              ))}
            </select>
            {candidatePositions.some((p) => p.leavingLabel) && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Posisi bertanda &quot;akan kosong&quot; masih dipegang karyawan yang sudah mengundurkan diri sampai hari kerja terakhirnya. Karyawan baru boleh langsung ditempatkan di posisi yang sama; untuk beberapa hari ada dua pemegang Utama. Setelah hari kerja terakhir, karyawan yang keluar dinonaktifkan otomatis.
              </p>
            )}
            {candidatePositions.length === 0 && (
              <p className="mt-1 text-xs text-amber-700">
                Belum ada Posisi kosong untuk Jabatan/Department ini — buat terlebih dahulu di Pengaturan &gt; Posisi Organisasi.
              </p>
            )}
          </div>
        }
      />
      <EmployeeExtraFields
        educationLevels={educationLevels}
        ptkpStatuses={ptkpStatuses}
        withNationalId={false}
        mobileNumberDefault={candidate?.mobileNumber ?? undefined}
      />

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
