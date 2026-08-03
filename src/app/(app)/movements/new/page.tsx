import { notFound } from "next/navigation";
import { requireSession } from "@/lib/require-session";
import { canSubmitMovementRequest, isHrAdmin } from "@/lib/permissions";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SubmitMovementForm } from "./submit-movement-form";

export default async function NewMovementRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId } = await searchParams;
  const session = await requireSession();
  if (!employeeId) notFound();

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
