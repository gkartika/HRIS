"use client";

import { useActionState } from "react";
import { submitRecruitmentRequest, resubmitRecruitmentRequest } from "../actions";
import { t } from "@/lib/i18n/id";
import type { OrgUnit, Job, Employee } from "@/generated/prisma/client";
type EmployeeOption = Pick<Employee, "id" | "fullLegalName" | "employeeNumber">;

// Values of an existing request, used to pre-fill the form when a returned
// request is edited and sent again.
export interface RequestFormInitial {
  requestDate: string;
  reasonCode: string;
  departmentId: string;
  jobId: string | null;
  shiftCode: string;
  requestedHeadcount: number;
  jobDescriptionSnapshot: string;
  educationRequirementCode: string;
  workExperienceBand: string;
  ageBand: string;
  genderRequirement: string | null;
  requestedJobLevel: string;
  specialCriteria: string | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const FIELD = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export function CreateRequestForm({
  departments,
  jobs,
  employees,
  currentEmployeeId,
  isHrAdmin,
  resubmitRequestId,
  initial,
}: {
  departments: OrgUnit[];
  jobs: Job[];
  employees: EmployeeOption[];
  currentEmployeeId: string | null;
  isHrAdmin: boolean;
  /** Set when a returned request is being edited; the form then resubmits it. */
  resubmitRequestId?: string;
  initial?: RequestFormInitial;
}) {
  const isResubmit = !!resubmitRequestId;
  const action = isResubmit ? resubmitRecruitmentRequest.bind(null, resubmitRequestId) : submitRecruitmentRequest;
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.requestDate")}</label>
          <input
            name="requestDate"
            type="date"
            required
            defaultValue={initial?.requestDate ?? todayIso()}
            className={FIELD}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.reasonCode")}</label>
          <select name="reasonCode" required defaultValue={initial?.reasonCode ?? ""} className={FIELD}>
            <option value="">— Pilih —</option>
            <option value="REPLACEMENT">{t("recruitmentReasonCode.REPLACEMENT")}</option>
            <option value="ADDITIONAL">{t("recruitmentReasonCode.ADDITIONAL")}</option>
            <option value="DEVELOPMENT">{t("recruitmentReasonCode.DEVELOPMENT")}</option>
          </select>
        </div>

        {/* The requester is fixed once a request exists; only a new request lets Admin SDM pick who it is for. */}
        {isHrAdmin && !isResubmit ? (
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.submittedBy")}</label>
            <select
              name="requesterEmployeeId"
              required
              defaultValue={currentEmployeeId ?? ""}
              className={FIELD}
            >
              <option value="">— Pilih Karyawan —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullLegalName} ({e.employeeNumber})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.department")}</label>
          <select name="departmentId" required defaultValue={initial?.departmentId ?? ""} className={FIELD}>
            <option value="">— Pilih —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.unitName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.requestedPosition")}</label>
          <select name="jobId" defaultValue={initial?.jobId ?? ""} className={FIELD}>
            <option value="">— Belum ada jabatan spesifik —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobCode} {j.jobTitle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.shiftCode")}</label>
          <select name="shiftCode" required defaultValue={initial?.shiftCode ?? ""} className={FIELD}>
            <option value="">— Pilih —</option>
            <option value="SHIFT">{t("shiftCode.SHIFT")}</option>
            <option value="NON_SHIFT">{t("shiftCode.NON_SHIFT")}</option>
            {/* A request made before keeps the value it has when it is edited. */}
            {initial?.shiftCode && initial.shiftCode !== "SHIFT" && initial.shiftCode !== "NON_SHIFT" && (
              <option value={initial.shiftCode}>{t(`shiftCode.${initial.shiftCode}`)}</option>
            )}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.requestedHeadcount")}</label>
          <input
            name="requestedHeadcount"
            type="number"
            min={1}
            required
            defaultValue={initial?.requestedHeadcount ?? 1}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("recruitment.jobDescription")}</label>
        <textarea
          name="jobDescriptionSnapshot"
          required
          rows={3}
          defaultValue={initial?.jobDescriptionSnapshot ?? ""}
          className={FIELD}
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
              defaultValue={initial?.educationRequirementCode ?? ""}
              className={FIELD}
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
              defaultValue={initial?.workExperienceBand ?? ""}
              className={FIELD}
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
            <select name="ageBand" required defaultValue={initial?.ageBand ?? ""} className={FIELD}>
              <option value="">— Pilih —</option>
              <option value="AGE_18_25">{t("ageBandLabel.AGE_18_25")}</option>
              <option value="AGE_26_35">{t("ageBandLabel.AGE_26_35")}</option>
              <option value="AGE_36_45">{t("ageBandLabel.AGE_36_45")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("recruitment.genderRequirement")}</label>
            <select name="genderRequirement" defaultValue={initial?.genderRequirement ?? ""} className={FIELD}>
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
              defaultValue={initial?.requestedJobLevel ?? ""}
              className={FIELD}
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
            defaultValue={initial?.specialCriteria ?? ""}
            className={FIELD}
          />
        </div>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? t("common.loading") : isResubmit ? t("recruitment.resubmitButton") : t("recruitment.submitButton")}
      </button>
    </form>
  );
}
