import { prisma } from "@/lib/db";
import type { DryRunRow, ExportResult, CommitResult } from "./types";
import type { Session } from "next-auth";

export const label = "Peserta Pelatihan Wajib (Mandatory Training)";
export const templateHeaders = ["employeeNumber", "courseTitle", "refresherReason"];
export const templateExampleRow = { employeeNumber: "EMP0001", courseTitle: "K3 Dasar", refresherReason: "" };

// PDF workflow "B. ASSIGNMENT" mandatory path, list-upload variant of the
// same rule preview already built for MandatoryTrainingRule (TRN-13) — an
// explicit uploaded (employeeNumber, courseTitle) list instead of a live
// Department/Job/Position/Everyone query. "refresherReason" mirrors the
// Refresher Override rule: a duplicate active assignment is rejected unless
// this column is filled in, exactly like scheduleTrainingRequest/
// applyMandatoryTrainingRule's confirmed-refresher path.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const result: DryRunRow[] = [];
  const seenInFile = new Set<string>();

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2;
    const employeeNumber = raw.employeeNumber?.trim();
    const courseTitle = raw.courseTitle?.trim();
    const refresherReason = raw.refresherReason?.trim() || null;

    if (!employeeNumber || !courseTitle) {
      result.push({ rowNumber, raw, isValid: false, rejectionReason: "employeeNumber dan courseTitle wajib diisi.", action: null });
      continue;
    }

    const dedupeKey = `${employeeNumber}|${courseTitle}`.toLowerCase();
    if (seenInFile.has(dedupeKey)) {
      result.push({ rowNumber, raw, isValid: false, rejectionReason: "Baris ini duplikat dari baris lain pada berkas yang sama.", action: null });
      continue;
    }

    const employee = await prisma.employee.findFirst({ where: { employeeNumber, activeFlag: true } });
    if (!employee) {
      result.push({
        rowNumber,
        raw,
        isValid: false,
        rejectionReason: `Karyawan dengan NIK "${employeeNumber}" tidak ditemukan atau tidak aktif.`,
        action: null,
      });
      continue;
    }

    const course = await prisma.trainingCourse.findFirst({ where: { title: courseTitle, status: "PUBLISHED" } });
    if (!course) {
      result.push({
        rowNumber,
        raw,
        isValid: false,
        rejectionReason: `Pelatihan "${courseTitle}" tidak ditemukan atau belum dipublikasikan.`,
        action: null,
      });
      continue;
    }

    const existingActive = await prisma.learningAssignment.findFirst({
      where: { employeeId: employee.id, courseId: course.id, status: { not: "CANCELLED" } },
    });
    if (existingActive && !refresherReason) {
      result.push({
        rowNumber,
        raw,
        isValid: false,
        rejectionReason: 'Karyawan sudah memiliki penugasan aktif untuk pelatihan ini. Isi kolom "refresherReason" untuk penyegaran.',
        action: null,
      });
      continue;
    }

    seenInFile.add(dedupeKey);
    result.push({ rowNumber, raw, isValid: true, rejectionReason: null, action: "CREATE" });
  }

  return result;
}

export async function commitRow(raw: Record<string, string>, session?: Session): Promise<CommitResult> {
  const employeeNumber = raw.employeeNumber.trim();
  const courseTitle = raw.courseTitle.trim();
  const refresherReason = raw.refresherReason?.trim() || null;

  const employee = await prisma.employee.findFirstOrThrow({ where: { employeeNumber, activeFlag: true } });
  const course = await prisma.trainingCourse.findFirstOrThrow({ where: { title: courseTitle, status: "PUBLISHED" } });

  const existingActive = await prisma.learningAssignment.findFirst({
    where: { employeeId: employee.id, courseId: course.id, status: { not: "CANCELLED" } },
  });

  const assignment = await prisma.learningAssignment.create({
    data: {
      employeeId: employee.id,
      courseId: course.id,
      sourceType: "MANDATORY_RULE",
      assignedByAccountId: session!.user.id,
      status: "ASSIGNED",
      effectivenessRequiredSnapshot: course.effectivenessRequired,
      overrideReason: existingActive ? refresherReason : null,
    },
  });

  return { id: assignment.id, action: "CREATE" };
}

export async function exportData(): Promise<ExportResult> {
  const assignments = await prisma.learningAssignment.findMany({
    where: { sourceType: "MANDATORY_RULE", sourceMandatoryRuleId: null },
    include: { employee: { select: { employeeNumber: true } }, course: { select: { title: true } } },
    orderBy: { assignedAt: "desc" },
  });
  return {
    headers: templateHeaders,
    rows: assignments.map((a) => ({
      employeeNumber: a.employee.employeeNumber,
      courseTitle: a.course.title,
      refresherReason: a.overrideReason ?? "",
    })),
  };
}
