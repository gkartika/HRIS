"use client";

import { useActionState } from "react";
import { submitRecruitmentRequest } from "../actions";
import { t } from "@/lib/i18n/id";
import type { OrgUnit, Job, Position, Employee } from "@/generated/prisma/client";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateRequestForm({
  departments,
  jobs,
  positions,
  employees,
  currentEmployeeId,
  isHrAdmin,
}: {
  departments: OrgUnit[];
  jobs: Job[];
  positions: PositionOption[];
  employees: Employee[];
  currentEmployeeId: string | null;
  isHrAdmin: boolean;
}) {
  const [error, formAction, isPending] = useActionState(submitRecruitmentRequest, undefined);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.requestDate")}</label>
          <input
            name="requestDate"
            type="date"
            required
            defaultValue={todayIso()}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.reasonCode")}</label>
          <select name="reasonCode" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih —</option>
            <option value="REPLACEMENT">{t("recruitmentReasonCode.REPLACEMENT")}</option>
            <option value="ADDITIONAL">{t("recruitmentReasonCode.ADDITIONAL")}</option>
            <option value="DEVELOPMENT">{t("recruitmentReasonCode.DEVELOPMENT")}</option>
          </select>
        </div>

        {isHrAdmin ? (
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.submittedBy")}</label>
            <select
              name="requesterEmployeeId"
              required
              defaultValue={currentEmployeeId ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Pilih Karyawan —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.preferredName ?? e.fullLegalName} ({e.employeeNumber})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="requesterEmployeeId" value={currentEmployeeId ?? ""} />
        )}

        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.department")}</label>
          <select name="departmentId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.unitName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.job")}</label>
          <select name="jobId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobTitle} ({j.jobLevel})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.requestedPosition")}</label>
          <select name="requestedPositionId" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Belum ada posisi spesifik —</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.positionCode} — {p.job.jobTitle} ({p.orgUnit.unitName})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.shiftCode")}</label>
          <select name="shiftCode" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih —</option>
            <option value="SHIFT_1">{t("shiftCode.SHIFT_1")}</option>
            <option value="SHIFT_2">{t("shiftCode.SHIFT_2")}</option>
            <option value="SHIFT_3">{t("shiftCode.SHIFT_3")}</option>
            <option value="NON_SHIFT">{t("shiftCode.NON_SHIFT")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.requestedHeadcount")}</label>
          <input
            name="requestedHeadcount"
            type="number"
            min={1}
            required
            defaultValue={1}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("recruitment.jobDescription")}</label>
        <textarea
          name="jobDescriptionSnapshot"
          required
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-xs font-medium text-slate-500">Kriteria Kandidat</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.educationRequirement")}</label>
            <select
              name="educationRequirementCode"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Pilih —</option>
              <option value="S1_UNIVERSITY">{t("educationRequirementCode.S1_UNIVERSITY")}</option>
              <option value="D1_D3_ACADEMY">{t("educationRequirementCode.D1_D3_ACADEMY")}</option>
              <option value="SMA">{t("educationRequirementCode.SMA")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.workExperience")}</label>
            <select
              name="workExperienceBand"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Pilih —</option>
              <option value="NONE">{t("workExperienceBand.NONE")}</option>
              <option value="ONE_TO_TWO">{t("workExperienceBand.ONE_TO_TWO")}</option>
              <option value="THREE_TO_FOUR">{t("workExperienceBand.THREE_TO_FOUR")}</option>
              <option value="MORE_THAN_FIVE">{t("workExperienceBand.MORE_THAN_FIVE")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.ageBand")}</label>
            <select name="ageBand" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              <option value="AGE_18_25">{t("ageBandLabel.AGE_18_25")}</option>
              <option value="AGE_26_35">{t("ageBandLabel.AGE_26_35")}</option>
              <option value="AGE_36_45">{t("ageBandLabel.AGE_36_45")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.genderRequirement")}</label>
            <select name="genderRequirement" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Tidak ditentukan —</option>
              <option value="MALE">{t("gender.MALE")}</option>
              <option value="FEMALE">{t("gender.FEMALE")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.requestedJobLevel")}</label>
            <select
              name="requestedJobLevel"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Pilih —</option>
              <option value="DEPARTMENT_HEAD">{t("requestedJobLevel.DEPARTMENT_HEAD")}</option>
              <option value="SECTION_HEAD">{t("requestedJobLevel.SECTION_HEAD")}</option>
              <option value="SUPERVISOR">{t("requestedJobLevel.SUPERVISOR")}</option>
              <option value="STAFF_OPERATOR">{t("requestedJobLevel.STAFF_OPERATOR")}</option>
              <option value="HARIAN_LEPAS">{t("requestedJobLevel.HARIAN_LEPAS")}</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.specialCriteria")}</label>
          <textarea
            name="specialCriteria"
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : t("recruitment.submitButton")}
      </button>
    </form>
  );
}
