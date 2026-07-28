import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  requireSession,
  canListEmployees,
  projectEmployee,
  isHrAdmin,
  canManageAssignments,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { EmployeeProfileView } from "@/components/employee-profile-view";
import { AssignmentManagementPanel } from "./assignment-panel";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const isSelf = session.user.employeeId === id;

  if (!isSelf && !canListEmployees(session)) {
    return <p className="text-sm text-rose-600">{t("common.accessDenied")}</p>;
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      currentPosition: { include: { job: true, orgUnit: true } },
      assignments: {
        include: { position: { include: { job: true, orgUnit: true } } },
        orderBy: { effectiveFrom: "desc" },
      },
      files: true,
    },
  });
  if (!employee) notFound();

  await logAudit({
    actorAccountId: session.user.id,
    action: "VIEW",
    datasetName: "Employee",
    recordId: employee.id,
    reason: isSelf ? "Viewed own profile" : "Viewed employee detail",
  });

  const projected = projectEmployee(employee, session);
  // Documents carry their own sensitivity (many are Highly Restricted, e.g.
  // contracts) independent of which Employee fields a role can see — only the
  // owner or HR Admin should even know a given file exists (matches the
  // permission check in /api/files/[id]).
  const visibleFiles = isSelf || isHrAdmin(session) ? employee.files : [];
  const canEdit = isSelf || isHrAdmin(session);
  const canManage = canManageAssignments(session);

  const positions = canManage
    ? await prisma.position.findMany({
        include: { job: true, orgUnit: true },
        orderBy: { positionCode: "asc" },
      })
    : [];
  const activeNonPrimaryAssignments = employee.assignments
    .filter((a) => a.status === "ACTIVE" && a.assignmentType !== "PRIMARY")
    .map((a) => ({
      id: a.id,
      positionCode: a.position.positionCode,
      assignmentType: a.assignmentType,
    }));

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <Link
            href={`/employees/${employee.id}/edit`}
            className="text-sm text-indigo-600 hover:underline"
          >
            {t("common.edit")}
          </Link>
        </div>
      )}
      <EmployeeProfileView
        employee={projected}
        assignments={employee.assignments}
        files={visibleFiles}
      />
      {canManage && (
        <AssignmentManagementPanel
          employeeId={employee.id}
          positions={positions}
          activeNonPrimaryAssignments={activeNonPrimaryAssignments}
        />
      )}
    </div>
  );
}
