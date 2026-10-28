import { AccessDenied } from "@/components/access-denied";
import { requireSession } from "@/lib/require-session";
import { canManageRecruitment, isHrAdmin } from "@/lib/permissions";
import { getMovementSubmitDepartmentIds } from "@/lib/level3-scope";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n/id";
import { canRequestAcceptFulfillment, computeFulfillmentCounts } from "@/lib/recruitment";
import { OPEN_MOVEMENT_STATUSES } from "@/lib/movement";
import Link from "next/link";
import { SubmitMovementForm } from "./submit-movement-form";

export default async function NewMovementRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; candidateId?: string; recruitmentRequestId?: string }>;
}) {
  const { employeeId: preselectedEmployeeId, candidateId, recruitmentRequestId } = await searchParams;
  const session = await requireSession();

  // Single-page flow: "which employee" is just the first field of this
  // same form, not a separate picker/page — scoped to whoever this viewer
  // is actually eligible to submit for: every employee for HR Admin, or
  // everyone in a Department this viewer holds a Level-3 (3A/3B) Position
  // in (job level 2C or above).
  const isHrAdminUser = isHrAdmin(session);
  const level3DepartmentIds = isHrAdminUser ? [] : await getMovementSubmitDepartmentIds(session.user.employeeId);

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
  // Opened from a recruitment request by Admin SDM ("Isi dengan Mutasi"): a Mutasi into one of its vacant seats.
  let fillRow: { id: string; label: string; requesterEmployeeId: string; jobId: string; jobTitle: string } | null = null;
  if (recruitmentRequestId && isHrAdminUser) {
    const r = await prisma.recruitmentRequest.findUnique({
      where: { id: recruitmentRequestId },
      select: {
        id: true, requestNumber: true, requesterEmployeeId: true, jobId: true, status: true, requestedHeadcount: true, heldAt: true,
        job: { select: { jobTitle: true } },
        _count: { select: { fulfillments: true } },
      },
    });
    if (r) {
      const mutationsUnderway = await prisma.movementRequest.count({ where: { recruitmentRequestId: r.id, status: { in: OPEN_MOVEMENT_STATUSES } } });
      const open = r.jobId && !r.heldAt && canRequestAcceptFulfillment(r.status) && !computeFulfillmentCounts(r.requestedHeadcount, r._count.fulfillments).isFull && r._count.fulfillments + mutationsUnderway < r.requestedHeadcount;
      if (!open) {
        return (
          <div className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Permintaan {r.requestNumber} tidak bisa diisi dengan Mutasi sekarang: belum disetujui, sedang ditahan, sudah terisi penuh, atau semua kursinya sedang diisi Mutasi lain.{" "}
            <Link href={`/recruitment/${r.id}`} className="font-medium underline">Kembali ke permintaan</Link>
          </div>
        );
      }
      fillRow = { id: r.id, label: `${r.job?.jobTitle ?? "permintaan"} (${r.requestNumber})`, requesterEmployeeId: r.requesterEmployeeId, jobId: r.jobId!, jobTitle: r.job?.jobTitle ?? "" };
    }
  }
  const viaCandidateOnly = !isHrAdminUser && level3DepartmentIds.length === 0 && !!candidateRow;
  if (!isHrAdminUser && level3DepartmentIds.length === 0 && !viaCandidateOnly) {
    return <AccessDenied />;
  }

  const [eligibleEmployees, positions, requesterCandidates, jobs, units] = await Promise.all([
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
      where: fillRow
        ? { archived: false, positionStatus: "VACANT", jobId: fillRow.jobId }
        : viaCandidateOnly
        ? { archived: false, positionStatus: "VACANT", jobId: candidateRow!.jobId ?? "__none__" }
        : { archived: false },
      include: { job: true, orgUnit: true },
      orderBy: { positionCode: "asc" },
    }),
    isHrAdminUser ? prisma.employee.findMany({ orderBy: { fullLegalName: "asc" }, select: { id: true, fullLegalName: true, employeeNumber: true } }) : Promise.resolve([]),
    // Tambah Posisi picks a standard Jabatan and a unit (the seat may not exist yet).
    prisma.job.findMany({ orderBy: { jobTitle: "asc" }, select: { id: true, jobTitle: true } }),
    prisma.orgUnit.findMany({ where: { activeFlag: true }, orderBy: [{ unitType: "asc" }, { unitName: "asc" }], select: { id: true, unitName: true, unitType: true } }),
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
          jobs={jobs}
          units={units}
          requesterCandidates={requesterCandidates}
          currentEmployeeId={session.user.employeeId}
          isHrAdmin={isHrAdminUser}
          candidate={candidate}
          fillRequest={fillRow}
        />
      </div>
    </div>
  );
}
