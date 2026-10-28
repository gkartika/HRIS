"use client";

import { useActionState, useMemo, useState } from "react";
import { submitMovementRequest } from "../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, Position, Job, OrgUnit, Assignment } from "@/generated/prisma/client";
type CandidateOption = Pick<Employee, "id" | "fullLegalName" | "employeeNumber">;
type PositionOption = Position & { job: Job; orgUnit: OrgUnit };
type AssignmentOption = Assignment & { position: PositionOption };
type EmployeeOption = Employee & {
  currentPosition: PositionOption | null;
  assignments: AssignmentOption[];
};

// Perubahan Posisi refactor: only these three types are offered here —
// Rotasi and Perubahan Status remain valid historical types (never removed
// from the schema/DB) but are no longer creatable through this form.
const MOVEMENT_TYPES = ["PROMOTION", "MUTATION", "DEMOTION", "ADD_POSITION"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Single-page flow: "which employee" is just the first field of this same
// form now, not a separate picker page — selecting one switches which of
// their current Assignments can be chosen, entirely client-side (every
// eligible employee's Assignment data is already loaded).
export function SubmitMovementForm({
  employees,
  defaultEmployeeId,
  positions,
  jobs,
  units,
  requesterCandidates,
  currentEmployeeId,
  isHrAdmin,
  candidate,
  fillRequest,
}: {
  employees: EmployeeOption[];
  defaultEmployeeId: string;
  positions: PositionOption[];
  jobs: { id: string; jobTitle: string }[];
  units: { id: string; unitName: string; unitType: string }[];
  requesterCandidates: CandidateOption[];
  currentEmployeeId: string | null;
  isHrAdmin: boolean;
  /** Set when HR Admin opened this form from an internal applicant. */
  candidate?: { id: string; label: string; requesterEmployeeId: string } | null;
  /** Set when Admin SDM opened this form from a recruitment request to fill it with a Mutasi. */
  fillRequest?: { id: string; label: string; requesterEmployeeId: string; jobId: string; jobTitle: string } | null;
}) {
  const [error, formAction, isPending] = useActionState(submitMovementRequest, undefined);
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId);
  const [movementType, setMovementType] = useState<(typeof MOVEMENT_TYPES)[number] | "">(fillRequest ? "MUTATION" : "");

  const employee = useMemo(() => employees.find((e) => e.id === employeeId) ?? null, [employees, employeeId]);
  const assignments = employee?.assignments ?? [];
  const primaryAssignment = assignments.find((a) => a.assignmentType === "PRIMARY");
  // a Mutasi needs no evaluation, so there is nothing to reference for it
  const needsEvaluation = movementType === "PROMOTION" || movementType === "DEMOTION";
  // Mutasi and Tambah Posisi name a standard Jabatan and a unit; an internal applicant's move keeps naming a position.
  const jobBased = (movementType === "MUTATION" || movementType === "ADD_POSITION") && !candidate;
  const requesterDefault = fillRequest?.requesterEmployeeId ?? candidate?.requesterEmployeeId ?? currentEmployeeId ?? "";

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2">
      {candidate && (
        <>
          <input type="hidden" name="candidateId" value={candidate.id} />
          <p className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900 md:col-span-2">
            Dari lamaran internal: {candidate.label}. Pilih jenis perubahan dan posisi baru yang dilamar.
          </p>
        </>
      )}
      {fillRequest && (
        <>
          <input type="hidden" name="recruitmentRequestId" value={fillRequest.id} />
          <p className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900 md:col-span-2">
            Mengisi permintaan tenaga kerja {fillRequest.label} dengan Mutasi. Pilih karyawan dan kursi kosong yang akan diisi. Mutasi tidak butuh evaluasi.
          </p>
        </>
      )}
      {isHrAdmin && !fillRequest ? (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.submittedBy")}</label>
          <select
            name="requesterEmployeeId"
            required
            defaultValue={requesterDefault}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">— Pilih Karyawan —</option>
            {requesterCandidates.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="requesterEmployeeId" value={requesterDefault} />
      )}

      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
        <select
          name="employeeId"
          required
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Pilih —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullLegalName} ({e.employeeNumber})
              {e.currentPosition ? ` — ${e.currentPosition.job.jobTitle} · ${e.currentPosition.orgUnit.unitName}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("movement.movementType")}</label>
        {fillRequest ? (
          <>
            <input type="hidden" name="movementType" value="MUTATION" />
            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">{t("movementType.MUTATION")}</p>
          </>
        ) : (
          <select
            name="movementType"
            required
            value={movementType}
            onChange={(e) => setMovementType(e.target.value as (typeof MOVEMENT_TYPES)[number])}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">— Pilih —</option>
            {MOVEMENT_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {t(`movementType.${mt}`)}
              </option>
            ))}
          </select>
        )}
        {movementType === "ADD_POSITION" && (
          <p className="mt-1.5 text-xs text-slate-500">{t("movement.addPositionHint")}</p>
        )}
        {movementType === "MUTATION" && !candidate && (
          <p className="mt-1.5 text-xs text-slate-500">{t("movement.mutationJobHint")}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("movement.currentAssignment")}</label>
        {!employee ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400">
            — {t("employee.fullLegalName")} —
          </p>
        ) : assignments.length <= 1 ? (
          <>
            <input type="hidden" name="currentAssignmentId" value={(primaryAssignment ?? assignments[0])?.id ?? ""} />
            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {(primaryAssignment ?? assignments[0])?.position.job.jobTitle ?? "—"} (
              {(primaryAssignment ?? assignments[0])?.position.positionCode ?? "—"})
            </p>
          </>
        ) : (
          <select
            name="currentAssignmentId"
            required
            defaultValue={primaryAssignment?.id ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">— Pilih —</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.position.job.jobTitle} ({a.position.positionCode}) — {t(`assignmentType.${a.assignmentType}`)}
              </option>
            ))}
          </select>
        )}
      </div>

      {jobBased ? (
        <>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedJob")}</label>
            {fillRequest ? (
              <>
                <input type="hidden" name="proposedJobId" value={fillRequest.jobId} />
                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">{fillRequest.jobTitle}</p>
              </>
            ) : (
              <select name="proposedJobId" required defaultValue="" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">— Pilih —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobTitle}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-slate-500">{fillRequest ? "Jabatan mengikuti permintaan tenaga kerja yang diisi." : t("movement.proposedJobHint")}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedUnit")}</label>
            <select name="proposedOrgUnitId" required defaultValue="" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Pilih —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">{t("movement.proposedUnitHint")}</p>
          </div>
        </>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedPosition")}</label>
          <select name="proposedPositionId" required defaultValue="" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">— Pilih —</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.positionCode} — {p.jobLevel} {p.job.jobTitle} ({p.orgUnit.unitName})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedEffectiveDate")}</label>
        <input
          name="proposedEffectiveDate"
          type="date"
          required
          defaultValue={todayIso()}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">{t("movement.requestReason")}</label>
        <textarea
          name="requestReason"
          required
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      {needsEvaluation && (
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-slate-500">{t("movement.performanceEvaluationRef")}</label>
          <input
            type="text"
            name="performanceEvaluationRef"
            placeholder="FR-HC-05-01 — ..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-amber-700">{t("movement.performanceEvaluationLinkNotice")}</p>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 md:col-span-2">{error}</p>}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("movement.submitButton")}
        </button>
      </div>
    </form>
  );
}
