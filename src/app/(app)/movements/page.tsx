import Link from "next/link";
import { pageParams } from "@/lib/pagination";
import { Pager } from "@/components/pager";
import { FilePlus } from "lucide-react";
import { requireSession } from "@/lib/require-session";
import { isHrAdmin, canSubmitMovementRequest } from "@/lib/permissions";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { getActiveLevel3Positions } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { EmptyState } from "@/components/empty-state";
import type { Prisma, MovementRequestStatus, MovementType } from "@/generated/prisma/client";

const MOVEMENT_STATUSES: MovementRequestStatus[] = [
  "PENDING_DEPT_HEAD",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "IMPLEMENTED",
  "CANCELLED",
];
const MOVEMENT_TYPES: MovementType[] = ["PROMOTION", "ROTATION", "MUTATION", "DEMOTION", "STATUS_CHANGE"];

export default async function MovementListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string;
    requestNumber?: string;
    employeeId?: string;
    status?: string;
    movementType?: string;
    departmentId?: string;
    currentPositionId?: string;
    proposedPositionId?: string;
    requesterEmployeeId?: string;
    approverAccountId?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
  }>;
}) {
  const session = await requireSession();
  const hrManagerPositions = await getActiveHrManagerPositions(session.user.employeeId);
  const isHrManagerNow = hrManagerPositions.length > 0;
  const deptHeadDepartmentIds = await getDeptHeadDepartmentIds(session.user.employeeId);
  const isHrAdminUser = isHrAdmin(session);
  const seesAll = isHrAdminUser || isHrManagerNow;
  const level3Positions = await getActiveLevel3Positions(session.user.employeeId);
  const canSubmit = canSubmitMovementRequest(session, level3Positions.length > 0);

  const {
    requestNumber,
    employeeId,
    status,
    movementType,
    departmentId,
    currentPositionId,
    proposedPositionId,
    requesterEmployeeId,
    approverAccountId,
    effectiveFrom,
    effectiveTo,
    page: pageRaw,
  } = await searchParams;

  // Perubahan Posisi refactor: Department Head 3B sees every request within
  // a department they hold that authority in, in addition to their own
  // submitted/affected requests — not scoped to HR Manager/HR Admin alone.
  // Every filter below is its own AND-ed condition (never merged into a
  // shared OR array with the visibility scope) — mixing them would let an
  // unprivileged viewer widen their own visibility via a filter value
  // instead of narrowing it.
  const conditions: Prisma.MovementRequestWhereInput[] = [];
  if (!seesAll) {
    conditions.push({
      OR: [
        { requesterEmployeeId: session.user.employeeId ?? "__none__" },
        { employeeId: session.user.employeeId ?? "__none__" },
        ...(deptHeadDepartmentIds.length > 0
          ? [
              {
                currentPosition: {
                  orgUnit: { OR: [{ id: { in: deptHeadDepartmentIds } }, { parentUnitId: { in: deptHeadDepartmentIds } }] },
                },
              },
            ]
          : []),
      ],
    });
  }
  if (requestNumber) conditions.push({ requestNumber: { contains: requestNumber, mode: "insensitive" } });
  if (employeeId) conditions.push({ employeeId });
  if (status) conditions.push({ status: status as MovementRequestStatus });
  if (movementType) conditions.push({ movementType: movementType as MovementType });
  if (currentPositionId) conditions.push({ currentPositionId });
  if (proposedPositionId) conditions.push({ proposedPositionId });
  if (requesterEmployeeId) conditions.push({ requesterEmployeeId });
  if (approverAccountId) {
    conditions.push({
      OR: [{ decisionByAccountId: approverAccountId }, { deptHeadDecisionByAccountId: approverAccountId }],
    });
  }
  if (departmentId) {
    conditions.push({
      currentPosition: { orgUnit: { OR: [{ id: departmentId }, { parentUnitId: departmentId }] } },
    });
  }
  if (effectiveFrom || effectiveTo) {
    conditions.push({
      proposedEffectiveDate: {
        ...(effectiveFrom ? { gte: new Date(effectiveFrom) } : {}),
        ...(effectiveTo ? { lte: new Date(effectiveTo) } : {}),
      },
    });
  }
  const where: Prisma.MovementRequestWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const { page, skip, take } = pageParams(pageRaw);
  const [total, requests, departments, positions, employees, approverAccounts] = await Promise.all([
    prisma.movementRequest.count({ where }),
    prisma.movementRequest.findMany({
      skip,
      take,
      where,
      include: {
        employee: true,
        currentPosition: { include: { job: true, orgUnit: true } },
        proposedPosition: { include: { job: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.orgUnit.findMany({ where: { unitType: "DEPARTMENT" }, orderBy: { unitName: "asc" } }),
    prisma.position.findMany({ include: { job: true }, orderBy: { positionCode: "asc" } }),
    prisma.employee.findMany({ orderBy: { fullLegalName: "asc" }, select: { id: true, fullLegalName: true, employeeNumber: true } }),
    prisma.account.findMany({
      where: { OR: [{ movementRequestsDecidedBy: { some: {} } }, { movementRequestsDeptHeadDecisionsBy: { some: {} } }] },
      orderBy: { usernameOrEmail: "asc" },
    }),
  ]);

  const hasFilters = !!(
    requestNumber ||
    employeeId ||
    status ||
    movementType ||
    departmentId ||
    currentPositionId ||
    proposedPositionId ||
    requesterEmployeeId ||
    approverAccountId ||
    effectiveFrom ||
    effectiveTo
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-900">{t("movement.listTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("movement.listSubtitle")}</p>
        </div>
        {canSubmit && (
          <Link
            href="/movements/new"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <FilePlus size={14} />
            {t("movement.newRequest")}
          </Link>
        )}
      </div>

      <form className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.requestNumber")}</label>
          <input
            name="requestNumber"
            defaultValue={requestNumber ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("employee.fullLegalName")}</label>
          <select name="employeeId" defaultValue={employeeId ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.movementType")}</label>
          <select name="movementType" defaultValue={movementType ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {MOVEMENT_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {t(`movementType.${mt}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.status")}</label>
          <select name="status" defaultValue={status ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {MOVEMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`movementStatus.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.department")}</label>
          <select name="departmentId" defaultValue={departmentId ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.unitName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.currentPosition")}</label>
          <select name="currentPositionId" defaultValue={currentPositionId ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.positionCode} — {p.job.jobTitle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.proposedPosition")}</label>
          <select name="proposedPositionId" defaultValue={proposedPositionId ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.positionCode} — {p.job.jobTitle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("recruitment.submittedBy")}</label>
          <select name="requesterEmployeeId" defaultValue={requesterEmployeeId ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullLegalName} ({e.employeeNumber})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.approver")}</label>
          <select name="approverAccountId" defaultValue={approverAccountId ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("common.allOption")}</option>
            {approverAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.usernameOrEmail}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.effectiveFrom")}</label>
          <input type="date" name="effectiveFrom" defaultValue={effectiveFrom ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t("movement.effectiveTo")}</label>
          <input type="date" name="effectiveTo" defaultValue={effectiveTo ?? ""} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("common.applyFilter")}
          </button>
          {hasFilters && (
            <Link href="/movements" className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
              {t("common.resetFilter")}
            </Link>
          )}
        </div>
      </form>

      {requests.length === 0 ? (
        <EmptyState filtered={hasFilters} message={t("movement.emptyState")} resetHref="/movements" action={canSubmit ? { href: "/movements/new", label: "Ajukan Perubahan Posisi" } : undefined} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("movement.requestNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("movement.movementType")}</th>
                <th className="px-4 py-3 font-medium">{t("movement.fromTo")}</th>
                <th className="px-4 py-3 font-medium">{t("recruitment.status")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/movements/${r.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.employee.fullLegalName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t(`movementType.${r.movementType}`)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.currentPosition.job.jobTitle} → {r.proposedPosition.job.jobTitle}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {t(`movementStatus.${r.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} basePath="/movements" params={{ requestNumber, employeeId, status, movementType, departmentId, currentPositionId, proposedPositionId, requesterEmployeeId, approverAccountId, effectiveFrom, effectiveTo }} />
    </div>
  );
}
