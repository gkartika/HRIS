import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSession } from "@/lib/require-session";
import { canManageRecruitment } from "@/lib/permissions";
import { readPrivateFile } from "@/lib/file-storage";
import { logAudit } from "@/lib/audit";

// An applicant's CV or offering letter. Admin SDM and Admin Rekrutmen may open any; an interviewer or essay
// reviewer may open the CV of an applicant they were assigned. Every open is logged.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await prisma.recruitmentFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let canView = canManageRecruitment(session);
  const me = session.user.employeeId;
  if (!canView && me) {
    const assigned = await prisma.recruitmentCandidate.findFirst({
      where: {
        cvFileId: id,
        OR: [
          { interview: { is: { interviewers: { some: { employeeId: me } } } } },
          { tests: { some: { reviewers: { some: { employeeId: me } } } } },
        ],
      },
      select: { id: true },
    });
    canView = !!assigned;
  }
  if (!canView) {
    await logAudit({ actorAccountId: session.user.id, action: "VIEW", datasetName: "RecruitmentFile", recordId: id, reason: "Access denied" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readPrivateFile(file.storageKey);
  if (!bytes) return NextResponse.json({ error: "Berkas tidak ditemukan di penyimpanan." }, { status: 404 });
  await logAudit({ actorAccountId: session.user.id, action: "VIEW", datasetName: "RecruitmentFile", recordId: id, reason: `Opened "${file.fileName}"` });
  const safeName = file.fileName.replace(/[^\w.\- ]/g, "_");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
