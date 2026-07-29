"use client";

import { useActionState, useState } from "react";
import { submitMovementRequest } from "../actions";
import { t } from "@/lib/i18n/id";
import type { Employee, Position, Job, OrgUnit } from "@/generated/prisma/client";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };

const MOVEMENT_TYPES = ["PROMOTION", "ROTATION", "MUTATION", "DEMOTION", "STATUS_CHANGE"] as const;
const EMPLOYMENT_STATUSES = ["PKWTT", "PKWT", "HARIAN_LEPAS", "MAGANG"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function SubmitMovementForm({
  employee,
  positions,
  employees,
  currentEmployeeId,
  isHrAdmin,
}: {
  employee: Employee;
  positions: PositionOption[];
  employees: Employee[];
  currentEmployeeId: string | null;
  isHrAdmin: boolean;
}) {
  const [error, formAction, isPending] = useActionState(submitMovementRequest, undefined);
  const [movementType, setMovementType] = useState<(typeof MOVEMENT_TYPES)[number] | "">("");
  const isStatusChange = movementType === "STATUS_CHANGE";

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
        <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedPosition")}</label>
        <select
          name="proposedPositionId"
          required
          defaultValue={isStatusChange ? employee.currentPositionId ?? "" : ""}
          disabled={isStatusChange}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">— Pilih —</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.positionCode} — {p.job.jobTitle} ({p.orgUnit.unitName})
            </option>
          ))}
        </select>
        {isStatusChange && (
          <p className="mt-1 text-xs text-slate-400">{t("movement.statusChangeKeepsPosition")}</p>
        )}
        {isStatusChange && <input type="hidden" name="proposedPositionId" value={employee.currentPositionId ?? ""} />}
      </div>

      {isStatusChange && (
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedEmploymentStatus")}</label>
          <select
            name="proposedEmploymentStatus"
            required={isStatusChange}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">— Pilih —</option>
            {EMPLOYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`employmentStatus.${s}`)}
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
