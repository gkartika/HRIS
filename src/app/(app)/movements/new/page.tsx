import { requireSession } from "@/lib/require-session";
import { isHrAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SubmitMovementForm } from "./submit-movement-form";

export default async function NewMovementRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId: preselectedEmployeeId } = await searchParams;
  const session = await requireSession();

  // Single-page flow: "which employee" is just the first field of this
  // same form, not a separate picker/page — scoped to whoever this viewer
  // is actually eligible to submit for: every employee for HR Admin, or
  // everyone in a Department this viewer holds a Level-3 (3A/3B) Position
  // in.
  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = isHrAdminUser ? [] : await getLevel3DepartmentIds(session.user.employeeId);
  if (!isHrAdminUser && level3DepartmentIds.length === 0) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const [eligibleEmployees, positions, requesterCandidates] = await Promise.all([
    prisma.employee.findMany({
      where: isHrAdminUser
        ? {}
        : {
            currentPosition: {
              orgUnit: {
                OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }],
              },
            },
          },
      include: {
        currentPosition: { include: { job: true, orgUnit: true } },
        assignments: {
          where: { status: "ACTIVE" },
          include: { position: { include: { job: true, orgUnit: true } } },
        },
      },
      orderBy: { fullLegalName: "asc" },
    }),
    prisma.position.findMany({
      where: { archived: false },
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
    isHrAdminUser ? prisma.employee.findMany({ orderBy: { fullLegalName: "asc" }, select: { id: true, fullLegalName: true, employeeNumber: true } }) : Promise.resolve([]),
  ]);

  if (eligibleEmployees.length === 0) {
    return <p className="text-sm text-rose-600">{t("movement.noEligibleEmployees")}</p>;
  }

  // Arriving from a specific Employee's own detail page pre-selects them —
  // if they're not actually eligible (stale link, access changed), just
  // fall back to no pre-selection instead of a hard 404.
  const defaultEmployeeId =
    preselectedEmployeeId && eligibleEmployees.some((e) => e.id === preselectedEmployeeId)
      ? preselectedEmployeeId
      : "";

  return (
    <div>
      <h1 className="text-lg font-medium text-slate-900">{t("movement.newRequest")}</h1>
      <div className="mt-4 max-w-2xl">
        <SubmitMovementForm
          employees={eligibleEmployees}
          defaultEmployeeId={defaultEmployeeId}
          positions={positions}
          requesterCandidates={requesterCandidates}
          currentEmployeeId={session.user.employeeId}
          isHrAdmin={isHrAdminUser}
        />
      </div>
    </div>
  );
}
