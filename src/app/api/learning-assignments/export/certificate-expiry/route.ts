import { csvResponse } from "@/lib/csv-response";
import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/require-session";
import { canManageLearningAssignment } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { rowsToCsv } from "@/lib/import-export/csv";

const HEADERS = ["employeeNumber", "employeeName", "course", "certificateNumber", "certificateIssueDate", "certificateExpiryDate", "expiryState"];

function expiryState(expiryDate: Date | null): string {
  if (!expiryDate) return "Tanpa Kedaluwarsa";
  const now = new Date();
  const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return "Kedaluwarsa";
  if (daysUntil <= 30) return "Segera Kedaluwarsa (<=30 hari)";
  return "Berlaku";
}

// Only completed assignments with a certificate ever have this data — a
// course that isn't certificateRequired, or an assignment still in
// progress, simply has null certificateNumber/expiryDate.
export async function GET() {
  const session = await getActiveSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageLearningAssignment(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignments = await prisma.learningAssignment.findMany({
    where: { status: "COMPLETED", certificateNumber: { not: null } },
    include: {
      employee: { select: { fullLegalName: true, employeeNumber: true } },
      course: { select: { title: true } },
    },
    orderBy: { certificateExpiryDate: "asc" },
  });

  const csv = rowsToCsv(
    HEADERS,
    assignments.map((a) => ({
      employeeNumber: a.employee.employeeNumber,
      employeeName: a.employee.fullLegalName,
      course: a.course.title,
      certificateNumber: a.certificateNumber ?? "",
      certificateIssueDate: a.certificateIssueDate ? a.certificateIssueDate.toISOString().slice(0, 10) : "",
      certificateExpiryDate: a.certificateExpiryDate ? a.certificateExpiryDate.toISOString().slice(0, 10) : "",
      expiryState: expiryState(a.certificateExpiryDate),
    }))
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "EXPORT",
    datasetName: "LearningAssignment",
    reason: `Exported ${assignments.length} certificate record(s)`,
  });

  return csvResponse(csv, "certificate-expiry.csv");
}
