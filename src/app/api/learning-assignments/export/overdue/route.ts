import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageLearningAssignment } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";

const HEADERS = ["employeeNumber", "employeeName", "course", "status", "sessionStartDate", "assignedAt"];

// "Overdue" is derived, not stored — this app has no due-date field on
// LearningAssignment (only TrainingSession.startDate as an actual schedule
// commitment), so overdue is scoped strictly to In-person/Blended
// assignments whose scheduled session has already passed without the
// assignment reaching COMPLETED/CANCELLED. Online assignments have no
// comparable schedule signal in the schema, so they're not included here
// rather than inventing an arbitrary day-count threshold.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageLearningAssignment(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignments = await prisma.learningAssignment.findMany({
    where: {
      status: { in: ["ASSIGNED", "ATTENDED"] },
      session: { startDate: { lt: new Date() } },
    },
    include: {
      employee: { select: { fullLegalName: true, employeeNumber: true } },
      course: { select: { title: true } },
      session: true,
    },
    orderBy: { session: { startDate: "asc" } },
  });

  const csv = rowsToCsv(
    HEADERS,
    assignments.map((a) => ({
      employeeNumber: a.employee.employeeNumber,
      employeeName: a.employee.fullLegalName,
      course: a.course.title,
      status: a.status,
      sessionStartDate: a.session?.startDate.toISOString().slice(0, 10) ?? "",
      assignedAt: a.assignedAt.toISOString().slice(0, 10),
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "LearningAssignment",
    reason: `Exported ${assignments.length} overdue learning assignment(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="learning-assignments-overdue.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
