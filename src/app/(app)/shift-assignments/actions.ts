"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canSubmitShiftAssignment, isHrAdmin } from "@/lib/permissions";
import { getActiveLevel3Positions, getLevel3DepartmentIds } from "@/lib/level3-scope";
import { normalizeWeekStart } from "@/lib/shift-assignment";
import { logAudit } from "@/lib/audit";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

// Bulk-only, per direct user request ("hard every week to add for
// everyone... choose multiple at once"): one shift type applied to every
// selected employee for one week, in a single upsert transaction. Replaces
// the earlier one-row-at-a-time form entirely — a single selected employee
// is just the n=1 case of the same flow, so there's no separate "single"
// action anymore.
export async function bulkSubmitShiftAssignment(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();

  const employeeIds = formData.getAll("employeeIds") as string[];
  const weekStartDateRaw = formData.get("weekStartDate") as string;
  const shiftType = formData.get("shiftType") as ShiftAssignmentType;
  const note = (formData.get("note") as string)?.trim() || null;

  if (employeeIds.length === 0) return "Pilih minimal satu karyawan.";
  if (!weekStartDateRaw || !shiftType) return "Minggu berlaku dan jenis shift wajib diisi.";

  const isHrOverride = isHrAdmin(session);
  const level3DepartmentIds = isHrOverride ? [] : await getLevel3DepartmentIds(session.user.employeeId);
  if (!canSubmitShiftAssignment(session, level3DepartmentIds.length > 0)) {
    return "Anda tidak memiliki akses. Hanya Level 3 (Kepala Seksi/Departemen) atau Admin SDM yang dapat mengatur shift.";
  }

  // Re-derive the caller's legitimate scope server-side rather than
  // trusting which checkboxes the client submitted — same defense-in-depth
  // as every other multi-target action in this app. Silently drops any id
  // outside scope instead of failing the whole batch.
  const authorizedEmployees = await prisma.employee.findMany({
    where: {
      id: { in: employeeIds },
      activeFlag: true,
      ...(isHrOverride
        ? {}
        : {
            currentPosition: {
              orgUnit: {
                OR: [{ id: { in: level3DepartmentIds } }, { parentUnitId: { in: level3DepartmentIds } }],
              },
            },
          }),
    },
    select: { id: true },
  });
  if (authorizedEmployees.length === 0) return "Tidak ada karyawan yang valid untuk diubah.";

  const weekStartDate = normalizeWeekStart(new Date(weekStartDateRaw));

  let submittedByPositionId: string | null = null;
  if (!isHrOverride) {
    const level3Positions = await getActiveLevel3Positions(session.user.employeeId);
    submittedByPositionId = level3Positions[0]?.positionId ?? null;
  }

  await prisma.$transaction(
    authorizedEmployees.map((emp) =>
      prisma.shiftAssignment.upsert({
        where: { employeeId_weekStartDate: { employeeId: emp.id, weekStartDate } },
        create: {
          employeeId: emp.id,
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
      })
    )
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "ShiftAssignment",
    reason: `Bulk update: ${authorizedEmployees.length} employee(s) set to ${shiftType} for week of ${weekStartDate.toISOString().slice(0, 10)}${isHrOverride ? " (HR override)" : ""}`,
  });

  revalidatePath("/shift-assignments");
}
