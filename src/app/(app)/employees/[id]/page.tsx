import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import {
  canListEmployees,
  projectEmployee,
  isHrAdmin,
  isTrainingAdmin,
  canManageAssignments,
  canViewEmployeeDocument,
  canUploadEmployeeDocument,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { t } from "@/lib/i18n/id";
import { EmployeeProfileView } from "@/components/employee-profile-view";
import { AssignmentManagementPanel } from "./assignment-panel";
import { IdentityDocumentsPanel } from "./identity-documents-panel";
import { isEmployeeProfileIncomplete, missingFieldLabels } from "@/lib/employee-completeness";

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
      educationLevel: true,
      ptkpStatus: true,
      ktpFile: true,
      kkFile: true,
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
  // permission check in /api/files/[id]). KTP/KK are excluded from the
  // generic list since they get their own dedicated panel below.
  const canViewDocs = canViewEmployeeDocument(session, employee.id);
  const visibleFiles = canViewDocs
    ? employee.files.filter((f) => f.category !== "KTP" && f.category !== "KK")
    : [];
  const canEdit = isSelf || isHrAdmin(session);
  const canManage = canManageAssignments(session);
  const canUploadDocs = canUploadEmployeeDocument(session);

  // noKk/namaIbuKandung/ptkpStatusCode are already stripped by projectEmployee
  // for roles that shouldn't see them. educationLevel isn't in that restricted
  // set (training-relevant), but still shouldn't reach GA Admin (ACC-04 is
  // limited to number/name/org placement/work location/assets).
  const canSeeEducation = isSelf || isHrAdmin(session) || isTrainingAdmin(session);
  const educationLevelLabel = canSeeEducation ? employee.educationLevel?.label ?? null : undefined;
  const ptkpLabel = canViewDocs
    ? employee.ptkpStatus
      ? `${employee.ptkpStatus.code} — ${employee.ptkpStatus.label}`
      : null
    : undefined;

  const incomplete = isEmployeeProfileIncomplete(employee);
  const missing = incomplete ? missingFieldLabels(employee) : [];

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
      {incomplete && (canEdit || canManage) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Data belum lengkap — lengkapi: {missing.join(", ")}.
        </div>
      )}
      <EmployeeProfileView
        employee={projected}
        assignments={employee.assignments}
        files={visibleFiles}
        educationLevelLabel={educationLevelLabel}
        ptkpLabel={ptkpLabel}
      />
      {canViewDocs && (
        <IdentityDocumentsPanel
          employeeId={employee.id}
          ktpFile={employee.ktpFile}
          kkFile={employee.kkFile}
          canUpload={canUploadDocs}
        />
      )}
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
