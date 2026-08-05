import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { normalizeWeekStart } from "@/lib/shift-assignment";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { ShiftRowForm } from "./shift-row-form";

// New module, per direct user request: HR Admin sees every active
// employee; a Level-3 (3A/3B) holder sees only employees in the
// department(s) they hold that authority in — same submit eligibility
// already used for Perubahan Posisi (src/lib/level3-scope.ts).
export default async function ShiftAssignmentsPage() {
  const session = await requireSession();
  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = await getLevel3DepartmentIds(session.user.employeeId);

  if (!isHrAdminUser && level3DepartmentIds.length === 0) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const weekStartDate = normalizeWeekStart(new Date());
  const weekStartDateIso = weekStartDate.toISOString().slice(0, 10);

  const employees = await prisma.employee.findMany({
    where: {
      activeFlag: true,
      ...(isHrAdminUser
        ? {}
        : {
            currentPosition: {
              orgUnit: {
                OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }],
              },
            },
          }),
    },
    include: { currentPosition: { include: { job: true, orgUnit: true } } },
    orderBy: { fullLegalName: "asc" },
  });

  const shiftAssignments = await prisma.shiftAssignment.findMany({
    where: { weekStartDate, employeeId: { in: employees.map((e) => e.id) } },
  });
  const shiftByEmployeeId = new Map(shiftAssignments.map((s) => [s.employeeId, s]));

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-medium text-slate-900">{t("shiftAssignment.navLabel")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {t("shiftAssignment.listSubtitle")} — {t("shiftAssignment.weekOf")}{" "}
          {new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(weekStartDate)}
        </p>
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-slate-400">{t("shiftAssignment.emptyState")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("employee.fullLegalName")}</th>
                <th className="px-4 py-3 font-medium">{t("employee.department")}</th>
                <th className="px-4 py-3 font-medium">{t("shiftAssignment.currentShift")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const current = shiftByEmployeeId.get(e.id);
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-900">
                      {e.preferredName ?? e.fullLegalName}
                      <span className="block text-xs text-slate-400">{e.employeeNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.currentPosition?.orgUnit.unitName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <ShiftRowForm
                        employeeId={e.id}
                        weekStartDateIso={weekStartDateIso}
                        currentShiftType={current?.shiftType ?? null}
                        currentNote={current?.note ?? null}
                      />
                      {current?.isHrOverride && (
                        <span className="mt-1 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t("shiftAssignment.hrOverrideBadge")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
