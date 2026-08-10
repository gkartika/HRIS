import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readPrivateFile } from "@/lib/file-storage";
import { logAudit } from "@/lib/audit";
import { isHrAdmin, canViewEmployeeDocument, canViewAbsenceRequest } from "@/lib/permissions";
import { isLevel3ForEmployeeDepartment } from "@/lib/level3-scope";
import { getCurrentHolderEmployeeIds } from "@/lib/position-holder";

// CTL-06: private file storage. No permanent public URL — every download goes
// through this handler, which re-checks the current session's permission and
// records a CTL-02 sensitive-access audit event before returning bytes.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
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
