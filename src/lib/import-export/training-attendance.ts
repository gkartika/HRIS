import { prisma } from "@/lib/db";
import type { DryRunRow, ExportResult, CommitResult } from "./types";

export const label = "Kehadiran Pelatihan Tatap Muka (In-person Attendance)";
export const templateHeaders = ["employeeNumber", "courseTitle", "attended", "note"];
export const templateExampleRow = { employeeNumber: "EMP0001", courseTitle: "K3 Dasar", attended: "Ya", note: "" };

const TRUTHY = new Set(["ya", "yes", "true", "1"]);

// PDF workflow section C, In-person/Blended branch: "Training Admin records
// attendance and evidence" — bulk variant of confirmLearningAssignmentAttendance
// (learning-assignments/actions.ts). Only positive attendance is a modeled
// action anywhere in this app (there's no "mark absent" workflow), so
// "attended" must read Ya/Yes/true/1 or the row is rejected.
export async function dryRun(rows: Record<string, string>[]): Promise<DryRunRow[]> {
  const result: DryRunRow[] = [];
  const seenInFile = new Set<string>();

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2;
    const employeeNumber = raw.employeeNumber?.trim();
    const courseTitle = raw.courseTitle?.trim();
    const attended = TRUTHY.has((raw.attended ?? "").trim().toLowerCase());

    if (!employeeNumber || !courseTitle) {
      result.push({ rowNumber, raw, isValid: false, rejectionReason: "employeeNumber dan courseTitle wajib diisi.", action: null });
      continue;
    }
    if (!attended) {
      result.push({
        rowNumber,
        raw,
        isValid: false,
        rejectionReason: 'Kolom "attended" harus diisi "Ya" untuk mengonfirmasi kehadiran.',
        action: null,
      });
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

    const course = await prisma.trainingCourse.findFirst({ where: { title: courseTitle } });
    if (!course) {
      result.push({ rowNumber, raw, isValid: false, rejectionReason: `Pelatihan "${courseTitle}" tidak ditemukan.`, action: null });
      continue;
    }
    if (course.mode === "ONLINE") {
      result.push({
        rowNumber,
        raw,
        isValid: false,
        rejectionReason: "Pelatihan Daring (Online) tidak memerlukan konfirmasi kehadiran.",
        action: null,
      });
      continue;
    }

    const assignment = await prisma.learningAssignment.findFirst({
      where: { employeeId: employee.id, courseId: course.id, status: "ASSIGNED" },
    });
    if (!assignment) {
      result.push({
        rowNumber,
        raw,
        isValid: false,
        rejectionReason: 'Tidak ada penugasan berstatus "Berjalan" untuk karyawan dan pelatihan ini.',
        action: null,
      });
      continue;
    }

    seenInFile.add(dedupeKey);
    result.push({ rowNumber, raw, isValid: true, rejectionReason: null, action: "UPDATE", existingId: assignment.id });
  }

  return result;
}

export async function commitRow(raw: Record<string, string>): Promise<CommitResult> {
  const employeeNumber = raw.employeeNumber.trim();
  const courseTitle = raw.courseTitle.trim();
  const note = raw.note?.trim() || null;

  const employee = await prisma.employee.findFirstOrThrow({ where: { employeeNumber, activeFlag: true } });
  const course = await prisma.trainingCourse.findFirstOrThrow({ where: { title: courseTitle } });
  const assignment = await prisma.learningAssignment.findFirstOrThrow({
    where: { employeeId: employee.id, courseId: course.id, status: "ASSIGNED" },
  });

  await prisma.learningAssignment.update({
    where: { id: assignment.id },
    data: { status: "ATTENDED", attendanceConfirmedAt: new Date(), attendanceEvidenceNote: note },
  });

  return { id: assignment.id, action: "UPDATE" };
}

export async function exportData(): Promise<ExportResult> {
  const assignments = await prisma.learningAssignment.findMany({
    where: { status: { in: ["ATTENDED", "COMPLETED"] }, course: { mode: { not: "ONLINE" } } },
    include: { employee: { select: { employeeNumber: true } }, course: { select: { title: true } } },
    orderBy: { attendanceConfirmedAt: "desc" },
  });
  return {
    headers: templateHeaders,
    rows: assignments.map((a) => ({
      employeeNumber: a.employee.employeeNumber,
      courseTitle: a.course.title,
      attended: "Ya",
      note: a.attendanceEvidenceNote ?? "",
    })),
  };
}
