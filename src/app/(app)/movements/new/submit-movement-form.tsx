"use client";

import { useActionState, useState } from "react";
import { submitMovementRequest } from "../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, Position, Job, OrgUnit, Assignment } from "@/generated/prisma/client";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };
type AssignmentOption = Assignment & { position: PositionOption };

// Perubahan Posisi refactor: only these three types are offered here —
// Rotasi and Perubahan Status remain valid historical types (never removed
// from the schema/DB) but are no longer creatable through this form.
const MOVEMENT_TYPES = ["PROMOTION", "MUTATION", "DEMOTION"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function SubmitMovementForm({
  employee,
  assignments,
  positions,
  employees,
  currentEmployeeId,
  isHrAdmin,
}: {
  employee: Employee;
  assignments: AssignmentOption[];
  positions: PositionOption[];
  employees: Employee[];
  currentEmployeeId: string | null;
  isHrAdmin: boolean;
}) {
  const [error, formAction, isPending] = useActionState(submitMovementRequest, undefined);
  const [movementType, setMovementType] = useState<(typeof MOVEMENT_TYPES)[number] | "">("");
  const primaryAssignment = assignments.find((a) => a.assignmentType === "PRIMARY");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2">
      <input type="hidden" name="employeeId" value={employee.id} />

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
        <label className="mb-1 block text-xs text-slate-500">{t("movement.movementType")}</label>
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
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("movement.currentAssignment")}</label>
        {assignments.length <= 1 ? (
          <>
            <input
              type="hidden"
              name="currentAssignmentId"
              value={(primaryAssignment ?? assignments[0])?.id ?? ""}
            />
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

      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedPosition")}</label>
        <select name="proposedPositionId" required defaultValue="" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.positionCode} — {p.job.jobTitle} / {p.job.jobLevel} ({p.orgUnit.unitName})
            </option>
          ))}
        </select>
      </div>

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

      {movementType === "PROMOTION" && (
        <p className="text-xs text-amber-700 md:col-span-2">{t("movement.promotionEvaluationNotice")}</p>
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
