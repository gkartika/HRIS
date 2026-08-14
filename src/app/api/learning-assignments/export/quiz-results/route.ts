import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageLearningAssignment } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";

const HEADERS = ["employeeNumber", "employeeName", "course", "attemptNumber", "scorePercent", "passed", "submittedAt"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageLearningAssignment(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attempts = await prisma.quizAttempt.findMany({
    include: {
      learningAssignment: {
        include: {
          employee: { select: { fullLegalName: true, employeeNumber: true } },
          course: { select: { title: true } },
        },
      },
    },
    orderBy: [{ learningAssignmentId: "asc" }, { attemptNumber: "asc" }],
  });

  const csv = rowsToCsv(
    HEADERS,
    attempts.map((a) => ({
      employeeNumber: a.learningAssignment.employee.employeeNumber,
      employeeName: a.learningAssignment.employee.fullLegalName,
      course: a.learningAssignment.course.title,
      attemptNumber: String(a.attemptNumber),
      scorePercent: a.scorePercent?.toFixed(1) ?? "",
      passed: a.passed === null ? "" : a.passed ? "Ya" : "Tidak",
      submittedAt: a.submittedAt ? a.submittedAt.toISOString().slice(0, 19).replace("T", " ") : "",
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "QuizAttempt",
    reason: `Exported ${attempts.length} quiz attempt(s)`,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quiz-results.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
