import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canManageRecruitment, isHrAdmin } from "@/lib/permissions";
import { getLevel3DepartmentIds } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { SubmitMovementForm } from "./submit-movement-form";

export default async function NewMovementRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; candidateId?: string }>;
}) {
  const { employeeId: preselectedEmployeeId, candidateId } = await searchParams;
  const session = await requireSession();

  // Single-page flow: "which employee" is just the first field of this
  // same form, not a separate picker/page — scoped to whoever this viewer
  // is actually eligible to submit for: every employee for HR Admin, or
  // everyone in a Department this viewer holds a Level-3 (3A/3B) Position
  // in.
  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = isHrAdminUser ? [] : await getLevel3DepartmentIds(session.user.employeeId);

  // Opened from an internal applicant's page by Admin SDM or Admin Rekrutmen. Admin Rekrutmen
  // gets this form for that one applicant only, nobody else's record.
  let candidateRow: {
    id: string;
    employeeId: string;
    label: string;
    requesterEmployeeId: string;
    jobId: string | null;
  } | null = null;
  if (candidateId && canManageRecruitment(session)) {
    const c = await prisma.recruitmentCandidate.findUnique({
      where: { id: candidateId },
      select: { id: true, source: true, employeeId: true, status: true, fullName: true, request: { select: { requestNumber: true, requesterEmployeeId: true, jobId: true, job: { select: { jobTitle: true } } } } },
    });
    if (c && c.source === "INTERNAL" && c.status === "MOVEMENT" && c.employeeId) {
      candidateRow = {
        id: c.id,
        employeeId: c.employeeId,
        requesterEmployeeId: c.request.requesterEmployeeId,
        jobId: c.request.jobId,
        label: `${c.fullName}, ${c.request.job?.jobTitle ?? "lowongan"} (${c.request.requestNumber})`,
      };
    }
  }
  const viaCandidateOnly = !isHrAdminUser && level3DepartmentIds.length === 0 && !!candidateRow;
  if (!isHrAdminUser && level3DepartmentIds.length === 0 && !viaCandidateOnly) {
    return <AccessDenied />;
  }

  const [eligibleEmployees, positions, requesterCandidates] = await Promise.all([
    prisma.employee.findMany({
      where: viaCandidateOnly
        ? { id: candidateRow!.employeeId }
        : isHrAdminUser
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
      where: viaCandidateOnly ? { archived: false, positionStatus: "VACANT", jobId: candidateRow!.jobId ?? "__none__" } : { archived: false },
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
  const wantedEmployeeId = candidateRow?.employeeId ?? preselectedEmployeeId;
  const defaultEmployeeId = wantedEmployeeId && eligibleEmployees.some((e) => e.id === wantedEmployeeId) ? wantedEmployeeId : "";
  const candidate =
    candidateRow && defaultEmployeeId === candidateRow.employeeId
      ? { id: candidateRow.id, label: candidateRow.label, requesterEmployeeId: candidateRow.requesterEmployeeId }
      : null;

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
          candidate={candidate}
        />
      </div>
    </div>
  );
}
