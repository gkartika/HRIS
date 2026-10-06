"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canSubmitShiftAssignment, isHrAdmin } from "@/lib/permissions";
import { getActiveLevel3Positions, getLevel3DepartmentIds } from "@/lib/level3-scope";
import { buildOrgUnitTree } from "@/lib/org-unit-tree";
import { normalizeWeekStart } from "@/lib/shift-assignment";
import { logAudit } from "@/lib/audit";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

export interface ShiftChange {
  employeeId: string;
  /** null = back to the default (Shift 1), which is stored as no row at all. */
  shiftType: ShiftAssignmentType | null;
}

export type SaveShiftResult = { ok: true; changed: number } | { ok: false; error: string };

// Only the deviations from the default are stored: "Shift 1" is simply the
// absence of a row for that employee/week (DEFAULT_SHIFT_TYPE), so putting
// someone back on Shift 1 deletes their row instead of writing a SHIFT_1 one.
// The whole week's edits arrive as one batch and are applied in one
// transaction, so the screen's Shift 2 -> Shift 3 -> Save flow is one save.
export async function saveShiftScheduleWeek(weekStartDateRaw: string, changes: ShiftChange[]): Promise<SaveShiftResult> {
  const session = await requireSession();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDateRaw) || Number.isNaN(new Date(weekStartDateRaw).getTime())) {
    return { ok: false, error: "Minggu tidak valid." };
  }
  if (!Array.isArray(changes) || changes.length === 0) return { ok: false, error: "Tidak ada perubahan untuk disimpan." };
  if (changes.length > 2000) return { ok: false, error: "Terlalu banyak perubahan sekaligus." };

  const validTypes: ShiftAssignmentType[] = ["SHIFT_2", "SHIFT_3", "NON_SHIFT"];
  for (const c of changes) {
    if (typeof c?.employeeId !== "string" || (c.shiftType !== null && !validTypes.includes(c.shiftType))) {
      return { ok: false, error: "Data perubahan tidak valid." };
    }
  }

  const isHrOverride = isHrAdmin(session);
  const level3DepartmentIds = isHrOverride ? [] : await getLevel3DepartmentIds(session.user.employeeId);
  if (!canSubmitShiftAssignment(session, level3DepartmentIds.length > 0)) {
    return { ok: false, error: "Anda tidak memiliki akses. Hanya Level 3 (Kepala Seksi/Departemen) atau Admin SDM yang dapat mengatur shift." };
  }

  // Re-derive the caller's legitimate scope server-side rather than
  // trusting which employees the client submitted. Anything outside the
  // caller's department(s) is silently dropped, not an error for the batch.
  const [units, candidates] = await Promise.all([
    prisma.orgUnit.findMany({ select: { id: true, unitName: true, unitType: true, parentUnitId: true } }),
    prisma.employee.findMany({
      where: { id: { in: changes.map((c) => c.employeeId) }, activeFlag: true },
      select: { id: true, currentPosition: { select: { orgUnitId: true } } },
    }),
  ]);
  const tree = buildOrgUnitTree(units);
  const inScope = new Set(
    candidates
      .filter((e) => {
        if (isHrOverride) return true;
        const departmentId = e.currentPosition ? tree.departmentOf(e.currentPosition.orgUnitId)?.id : undefined;
        return !!departmentId && level3DepartmentIds.includes(departmentId);
      })
      .map((e) => e.id)
  );
  const authorized = changes.filter((c) => inScope.has(c.employeeId));
  if (authorized.length === 0) return { ok: false, error: "Tidak ada karyawan yang valid untuk diubah." };

  const weekStartDate = normalizeWeekStart(new Date(weekStartDateRaw));

  let submittedByPositionId: string | null = null;
  if (!isHrOverride) {
    const level3Positions = await getActiveLevel3Positions(session.user.employeeId);
    submittedByPositionId = level3Positions[0]?.positionId ?? null;
  }

  const toDefault = authorized.filter((c) => c.shiftType === null).map((c) => c.employeeId);
  const toSet = authorized.filter((c): c is { employeeId: string; shiftType: ShiftAssignmentType } => c.shiftType !== null);

  // Replace the week's rows for every authorized employee in two statements
  // (delete, then bulk insert) instead of one upsert per employee.
  await prisma.$transaction([
    prisma.shiftAssignment.deleteMany({ where: { weekStartDate, employeeId: { in: authorized.map((c) => c.employeeId) } } }),
    prisma.shiftAssignment.createMany({
      data: toSet.map((c) => ({
        employeeId: c.employeeId,
        weekStartDate,
        shiftType: c.shiftType,
        isHrOverride,
        submittedByAccountId: session.user.id,
        submittedByPositionId,
      })),
    }),
  ]);

  const tally = (type: ShiftAssignmentType) => toSet.filter((c) => c.shiftType === type).length;
  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "ShiftAssignment",
    reason: `Week of ${weekStartDate.toISOString().slice(0, 10)}: ${tally("SHIFT_2")} to Shift 2, ${tally("SHIFT_3")} to Shift 3, ${tally("NON_SHIFT")} to Libur, ${toDefault.length} back to default (Shift 1)${isHrOverride ? " (HR override)" : ""}`,
  });

  revalidatePath("/shift-assignments");
  return { ok: true, changed: authorized.length };
}
