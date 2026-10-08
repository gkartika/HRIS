"use client";

import { useActionState } from "react";
import { createEmployeeFromRecruitmentRequest } from "../../actions";
import { t } from "@/lib/i18n/id";
import { EmployeeCoreFields, EmployeeExtraFields } from "@/components/employee-form-fields";
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
      <EmployeeCoreFields
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
        }
      />
      <EmployeeExtraFields educationLevels={educationLevels} ptkpStatuses={ptkpStatuses} withNationalId={false} />

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
