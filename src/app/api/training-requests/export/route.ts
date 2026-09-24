import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/require-session";
import { isHrAdmin, isTrainingAdmin } from "@/lib/permissions";
import { getDeptHeadDepartmentIds } from "@/lib/dept-head";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";
import { t } from "@/lib/i18n/id";
import type { Prisma } from "@/generated/prisma/client";
import type { TrainingRequestStatus } from "@/generated/prisma/enums";

const HEADERS = ["requestNumber", "employeeNumber", "employeeName", "requestedTopic", "reason", "status", "course", "session"];

// CTL-13: same visibility scope as the Training Request list page — HR/
// Training Admin see everything, everyone else sees only their own
// requests (submitted or subject) plus any Department they hold Level-3
// Department Head authority in.
export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = isHrAdmin(session) || isTrainingAdmin(session);
  const deptHeadDepartmentIds = await getDeptHeadDepartmentIds(session.user.employeeId);
  if (!isAdmin && !session.user.employeeId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Prisma.TrainingRequestWhereInput = {};
  if (status) where.status = status as TrainingRequestStatus;
  if (!isAdmin) {
    where.OR = [
      { employeeId: session.user.employeeId ?? "__none__" },
      { submittedByAccountId: session.user.id },
      ...(deptHeadDepartmentIds.length > 0 ? [{ departmentIdSnapshot: { in: deptHeadDepartmentIds } }] : []),
    ];
  }

  const requests = await prisma.trainingRequest.findMany({
    where,
    include: { employee: { select: { fullLegalName: true, employeeNumber: true } }, course: { select: { title: true } }, session: true },
    orderBy: { createdAt: "desc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    requests.map((r) => ({
      requestNumber: r.requestNumber,
      employeeNumber: r.employee.employeeNumber,
      employeeName: r.employee.fullLegalName,
      requestedTopic: r.requestedTopic,
      reason: t(`trainingRequest.reasonOptions.${r.reason}`),
      status: t(`trainingRequestStatus.${r.status}`),
      course: r.course?.title ?? "",
      session: r.session?.startDate.toISOString().slice(0, 10) ?? "",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "TrainingRequest",
    reason: `Exported ${requests.length} training request(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-requests.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
