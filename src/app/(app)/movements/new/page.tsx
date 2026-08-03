import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canSubmitMovementRequest, isHrAdmin } from "@/lib/permissions";
import { isLevel3ForEmployeeDepartment, getLevel3DepartmentIds } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SubmitMovementForm } from "./submit-movement-form";
import { PickEmployeeForm } from "./pick-employee-form";

export default async function NewMovementRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId } = await searchParams;
  const session = await requireSession();

  // Reached from the Perubahan Posisi list page (no employeeId yet, unlike
  // coming from a specific Employee's own detail page) — show a picker
  // scoped to whoever this viewer is actually eligible to submit for: every
  // employee for HR Admin, or everyone in a Department this viewer holds a
  // Level-3 (3A/3B) Position in.
  if (!employeeId) {
    const isHrAdminUser = isHrAdmin(session);
    const level3DepartmentIds = isHrAdminUser ? [] : await getLevel3DepartmentIds(session.user.employeeId);
    if (!isHrAdminUser && level3DepartmentIds.length === 0) {
      return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
    }

    const employees = await prisma.employee.findMany({
      where: isHrAdminUser
        ? {}
        : {
            currentPosition: {
              orgUnit: {
                OR: [
                  { id: { in: level3DepartmentIds } },
                  { parentUnitId: { in: level3DepartmentIds } },
                ],
              },
            },
          },
      include: { currentPosition: { include: { job: true, orgUnit: true } } },
      orderBy: { fullLegalName: "asc" },
    });

    return (
      <div>
        <h1 className="text-lg font-medium text-slate-900">{t("movement.newRequest")}</h1>
        <div className="mt-4 max-w-md">
          <PickEmployeeForm employees={employees} />
        </div>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      currentPosition: { include: { job: true, orgUnit: true } },
      assignments: {
        where: { status: "ACTIVE" },
        include: { position: { include: { job: true, orgUnit: true } } },
      },
    },
  });
  if (!employee) notFound();

  const eligible = await isLevel3ForEmployeeDepartment(session.user.employeeId, employeeId);
  if (!canSubmitMovementRequest(session, eligible)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }
  if (!employee.currentPositionId) {
    return <p className="text-sm text-rose-600">{t("movement.noCurrentPosition")}</p>;
  }

  const isHrAdminUser = isHrAdmin(session);
  const [positions, employees] = await Promise.all([
    prisma.position.findMany({
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
    isHrAdminUser
      ? prisma.employee.findMany({ orderBy: { fullLegalName: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("movement.newRequest")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {employee.preferredName ?? employee.fullLegalName} ({employee.employeeNumber}) —{" "}
        {employee.currentPosition?.job.jobTitle} · {employee.currentPosition?.orgUnit.unitName}
      </p>
      <div className="mt-4 max-w-2xl">
        <SubmitMovementForm
          employee={employee}
          assignments={employee.assignments}
          positions={positions}
          employees={employees}
          currentEmployeeId={session.user.employeeId}
          isHrAdmin={isHrAdminUser}
        />
      </div>
    </div>
  );
}
