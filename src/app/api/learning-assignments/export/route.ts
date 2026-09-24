import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/require-session";
import { canManageLearningAssignment } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";
import type { LearningAssignmentStatus } from "@/generated/prisma/enums";

const HEADERS = ["employeeNumber", "employeeName", "course", "session", "sourceType", "status", "completedAt", "certificateNumber", "effectivenessResult"];

// CTL-13: Training/HR Admin-only (matches the Learning Assignment list
// page's own gate — same as canManageLearningAssignment everywhere else).
export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageLearningAssignment(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const assignments = await prisma.learningAssignment.findMany({
    where: status ? { status: status as LearningAssignmentStatus } : undefined,
    include: {
      employee: { select: { fullLegalName: true, employeeNumber: true } },
      course: { select: { title: true } },
      session: true,
    },
    orderBy: { assignedAt: "desc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    assignments.map((a) => ({
      employeeNumber: a.employee.employeeNumber,
      employeeName: a.employee.fullLegalName,
      course: a.course.title,
      session: a.session?.startDate.toISOString().slice(0, 10) ?? "",
      sourceType: a.sourceType,
      status: a.status,
      completedAt: a.completedAt ? a.completedAt.toISOString().slice(0, 10) : "",
      certificateNumber: a.certificateNumber ?? "",
      effectivenessResult: a.effectivenessResult ?? "",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "LearningAssignment",
    reason: `Exported ${assignments.length} learning assignment(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="learning-assignments.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
