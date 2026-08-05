"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canSubmitShiftAssignment, isHrAdmin } from "@/lib/permissions";
import { isLevel3ForEmployeeDepartment, getActiveLevel3Positions } from "@/lib/level3-scope";
import { normalizeWeekStart } from "@/lib/shift-assignment";
import { logAudit } from "@/lib/audit";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

// New module, per direct user request: "assign shift or non shift for each
// employee... changes weekly and will be submitted by level 3." One upsert
// per employee/week (see ShiftAssignment.@@unique in schema.prisma) — a
// resubmission for the same week just overwrites the current value, same
// "current state, not a full history of edits" simplification already used
// for Employee.currentPositionId (full change history still lives in
// AuditLog). Unlike the formal Dept-Head/HR-Manager approval chains
// elsewhere in this app, this is a lightweight operational task with no
// decision-position picker — the submitter's first active Level-3 Position
// is recorded automatically as evidence.
export async function submitShiftAssignment(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const employeeId = formData.get("employeeId") as string;
  const weekStartDateRaw = formData.get("weekStartDate") as string;
  const shiftType = formData.get("shiftType") as ShiftAssignmentType;
  const note = (formData.get("note") as string)?.trim() || null;

  if (!employeeId || !weekStartDateRaw || !shiftType) {
    return "Karyawan, minggu berlaku, dan jenis shift wajib diisi.";
  }

  const isLevel3 = await isLevel3ForEmployeeDepartment(session.user.employeeId, employeeId);
  if (!canSubmitShiftAssignment(session, isLevel3)) {
    return "Anda tidak memiliki akses. Hanya Level 3 (Kepala Seksi/Departemen) di department karyawan ini atau Admin SDM yang dapat mengatur shift.";
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return "Karyawan tidak ditemukan.";

  const weekStartDate = normalizeWeekStart(new Date(weekStartDateRaw));
  const isHrOverride = isHrAdmin(session);

  let submittedByPositionId: string | null = null;
  if (!isHrOverride) {
    const level3Positions = await getActiveLevel3Positions(session.user.employeeId);
    submittedByPositionId = level3Positions[0]?.positionId ?? null;
  }

  const existing = await prisma.shiftAssignment.findUnique({
    where: { employeeId_weekStartDate: { employeeId, weekStartDate } },
  });

  await prisma.shiftAssignment.upsert({
    where: { employeeId_weekStartDate: { employeeId, weekStartDate } },
    create: {
      employeeId,
      weekStartDate,
      shiftType,
      note,
      isHrOverride,
      submittedByAccountId: session.user.id,
      submittedByPositionId,
    },
    update: {
      shiftType,
      note,
      isHrOverride,
      submittedAt: new Date(),
      submittedByAccountId: session.user.id,
      submittedByPositionId,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: existing ? "UPDATE" : "CREATE",
    datasetName: "ShiftAssignment",
    recordId: employeeId,
    reason: `${employee.employeeNumber} shift for week of ${weekStartDate.toISOString().slice(0, 10)} set to ${shiftType}${isHrOverride ? " (HR override)" : ""}`,
  });

  revalidatePath("/shift-assignments");
  revalidatePath(`/employees/${employeeId}`);
}
