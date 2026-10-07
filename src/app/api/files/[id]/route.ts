import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/require-session";
import { prisma } from "@/lib/db";
import { readPrivateFile } from "@/lib/file-storage";
import { logAudit } from "@/lib/audit";
import {
  isHrAdmin,
  isTrainingAdmin,
  isGaAdmin,
  canViewEmployeeDocument,
  canViewAbsenceRequest,
  canViewBpjsCard,
} from "@/lib/permissions";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";

// CTL-06: private file storage. No permanent public URL — every download goes
// through this handler, which re-checks the current session's permission and
// records a CTL-02 sensitive-access audit event before returning bytes.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getActiveSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let canView = file.employeeId ? canViewEmployeeDocument(session, file.employeeId) : isHrAdmin(session);
  // An Absence attachment (e.g. a doctor's note for Sakit) must also be
  // reachable by whoever is authorized to decide the request it's attached
  // to — self-or-HR-Admin alone would otherwise lock out the exact people
  // the approval workflow depends on (same class of gap as
  // canViewContractDetail's Dept Head widening).
  if (!canView && file.category === "ABSENCE_ATTACHMENT" && file.employeeId) {
    const request = await prisma.absenceRequest.findFirst({ where: { attachmentFileId: file.id } });
    if (request) {
      const [isLevel3, holderIds] = await Promise.all([
        isLevel3ForEmployeeDepartment(session.user.employeeId, file.employeeId),
        getCurrentHolderEmployeeIds(request.firstApproverPositionId),
      ]);
      canView = canViewAbsenceRequest(session, file.employeeId, isLevel3, holderIds);
    }
  }
  // Phase 3B: course materials have no `employeeId` (they're not
  // employee-specific), so the base branch above only ever admits HR Admin
  // for them — widen to Training Admin (Key Control "Training Admin owns
  // content") and any Employee currently enrolled in the material's course.
  if (!canView && file.category === "COURSE_MATERIAL") {
    canView = isTrainingAdmin(session);
    if (!canView && session.user.employeeId) {
      const material = await prisma.courseMaterial.findFirst({ where: { fileId: file.id } });
      if (material) {
        const enrollment = await prisma.learningAssignment.findFirst({
          where: { courseId: material.courseId, employeeId: session.user.employeeId, status: { not: "CANCELLED" } },
        });
        canView = !!enrollment;
      }
    }
  }
  // A Certificate or in-person Attendance Evidence file is owned by the
  // learner it's attached to (`file.employeeId`), but must also be reachable
  // by Training Admin — same widening reason as ABSENCE_ATTACHMENT above.
  if (!canView && (file.category === "CERTIFICATE" || file.category === "ATTENDANCE_EVIDENCE") && file.employeeId) {
    canView = isTrainingAdmin(session) || session.user.employeeId === file.employeeId;
  }
  // Phase 4A: handover/return evidence is attached to the Employee for an
  // Employee-target custody (self-view alongside GA Admin), but has no
  // employeeId at all for a Department/Location-target custody — GA Admin
  // still needs to reach those, so this check doesn't require file.employeeId
  // the way ABSENCE_ATTACHMENT/CERTIFICATE's widening does.
  if (!canView && (file.category === "ASSET_HANDOVER_EVIDENCE" || file.category === "ASSET_RETURN_EVIDENCE")) {
    canView = isGaAdmin(session) || (!!file.employeeId && session.user.employeeId === file.employeeId);
  }
  // Phase 4B: a GA request's own evidence is reachable by GA Admin or the
  // requester who attached it ("Requester sees only own requests" extends
  // to their evidence). Maintenance/disposal evidence is asset-centric, not
  // employee-linked, so there's no requester self-view case for those —
  // GA Admin only.
  if (!canView && file.category === "GA_REQUEST_EVIDENCE") {
    canView = isGaAdmin(session) || (!!file.employeeId && session.user.employeeId === file.employeeId);
  }
  if (
    !canView &&
    (file.category === "MAINTENANCE_EVIDENCE" ||
      file.category === "DISPOSAL_PROPOSAL_EVIDENCE" ||
      file.category === "DISPOSAL_EXECUTION_EVIDENCE")
  ) {
    canView = isGaAdmin(session);
  }
  // BPJS cards: broader read-only audience than other employee documents —
  // GA Admin and Training Admin need to pull one up (e.g. HSE handling a
  // workplace accident), on top of self/HR Admin already covered above.
  if (!canView && (file.category === "BPJS_TK" || file.category === "BPJS_KESEHATAN") && file.employeeId) {
    canView = canViewBpjsCard(session, file.employeeId);
  }

  if (!canView) {
    await logAudit({
      actorAccountId: session.user.id,
      action: "VIEW",
      datasetName: "FileObject",
      recordId: file.id,
      reason: "Access denied — insufficient permission",
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readPrivateFile(file.storageKey);
  if (!bytes) {
    return NextResponse.json({ error: "Berkas tidak ditemukan di penyimpanan." }, { status: 404 });
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "VIEW",
    datasetName: "FileObject",
    recordId: file.id,
    reason: `Downloaded "${file.originalFileName}"`,
  });

  const contentType = file.mimeType.startsWith("text/")
    ? `${file.mimeType}; charset=utf-8`
    : file.mimeType;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${file.originalFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
