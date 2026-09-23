"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { setAbsenceQuotaOverride } from "../../employees/[id]/absence-quota-actions";
import type { ShiftAssignmentType } from "@/generated/prisma/enums";

const VALID_SHIFT_TYPES: ShiftAssignmentType[] = ["SHIFT_1", "SHIFT_2", "SHIFT_3", "NON_SHIFT"];

// Machine code derived from the admin-entered label so HR Admin never has to
// invent one themselves — uppercase/underscore slug, uniqueness-checked
// against existing codes (including inactive ones, since the code is the
// stable key every existing AbsenceRequest/AbsenceEntitlementConfig joins
// against and must never collide, even after a type is deactivated).
async function deriveUniqueCode(label: string): Promise<string> {
  const base = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let code = base || "JENIS";
  let suffix = 2;
  while (await prisma.absenceTypeConfig.findUnique({ where: { code } })) {
    code = `${base}_${suffix}`;
    suffix += 1;
  }
  return code;
}

export async function createAbsenceTypeConfig(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Nama jenis absensi wajib diisi.";
  const requiresFirstApproval = formData.get("requiresFirstApproval") === "on";
  const employeeRequestable = formData.get("employeeRequestable") === "on";

  const code = await deriveUniqueCode(label);
  const maxSortOrder = await prisma.absenceTypeConfig.aggregate({ _max: { sortOrder: true } });

  const created = await prisma.absenceTypeConfig.create({
    data: {
      code,
      label,
      requiresFirstApproval,
      employeeRequestable,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AbsenceTypeConfig",
    recordId: created.id,
    reason: `Added Absence type ${code} (${label}), requiresFirstApproval=${requiresFirstApproval}`,
  });

  revalidatePath("/admin/absence-settings");
}

// One row, two models: AbsenceTypeConfig's shape/approval-chain fields and
// AbsenceEntitlementConfig's company-wide default quota, both keyed by the
// same absenceTypeCode — merged into a single save so HR Admin edits one
// row instead of two separate tables for the same type.
export async function updateAbsenceTypeAndQuota(
  absenceTypeCode: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Nama jenis absensi wajib diisi.";
  const requiresFirstApproval = formData.get("requiresFirstApproval") === "on";
  const activeFlag = formData.get("activeFlag") === "on";
  const employeeRequestable = formData.get("employeeRequestable") === "on";
  const countsTowardTdl = formData.get("countsTowardTdl") === "on";

  const pointsWeightRaw = (formData.get("pointsWeight") as string)?.trim();
  const pointsWeight = pointsWeightRaw ? Number(pointsWeightRaw) : 0;
  if (!Number.isFinite(pointsWeight) || !Number.isInteger(pointsWeight)) return "Bobot Poin wajib berupa angka bulat.";

  // Fraction of that day's scheduled shift hours to credit toward Total
  // Jam Kerja when this type is used to classify a day — 0 (not counted),
  // 1 (full day, e.g. SDSD/IK), 0.5 (half day, e.g. SH), or any other
  // fraction HR wants.
  const hoursMultiplierRaw = (formData.get("hoursMultiplier") as string)?.trim();
  const hoursMultiplier = hoursMultiplierRaw ? Number(hoursMultiplierRaw) : 0;
  if (!Number.isFinite(hoursMultiplier) || hoursMultiplier < 0) return "Pengali Jam Kerja wajib berupa angka 0 atau lebih.";

  // Blank clears any company-wide default entirely (unlimited / not
  // configured — resolveAnnualQuota treats "no row" as unlimited). A number,
  // including 0, is a real enforced quota: 0 means nobody gets this type by
  // default, and HR Admin grants an actual quota per person via the
  // per-employee override.
  const annualDaysRaw = (formData.get("annualDays") as string)?.trim();
  let annualDays: number | null = null;
  if (annualDaysRaw) {
    annualDays = Number(annualDaysRaw);
    if (!Number.isFinite(annualDays) || annualDays < 0) return "Jatah tahunan wajib diisi dengan angka 0 atau lebih, atau dikosongkan.";
  }

  await prisma.$transaction(async (tx) => {
    await tx.absenceTypeConfig.update({
      where: { code: absenceTypeCode },
      data: { label, requiresFirstApproval, activeFlag, employeeRequestable, pointsWeight, countsTowardTdl, hoursMultiplier },
    });
    if (annualDays === null) {
      await tx.absenceEntitlementConfig.deleteMany({ where: { absenceTypeCode } });
    } else {
      await tx.absenceEntitlementConfig.upsert({
        where: { absenceTypeCode },
        create: { absenceTypeCode, annualDays },
        update: { annualDays },
      });
    }
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceTypeConfig",
    recordId: absenceTypeCode,
    reason: `Updated ${absenceTypeCode}: label=${label}, requiresFirstApproval=${requiresFirstApproval}, activeFlag=${activeFlag}, employeeRequestable=${employeeRequestable}, pointsWeight=${pointsWeight}, countsTowardTdl=${countsTowardTdl}, hoursMultiplier=${hoursMultiplier}, annualDays=${annualDays ?? "unlimited"}`,
  });

  revalidatePath("/admin/absence-settings");
}

// Archives instead of deleting — per direct request, a hard delete only
// ever works when nothing real references the type (every historical
// AbsenceRequest/DailyAttendanceRecord would first need migrating to some
// other type, a real judgment call each time). Archiving needs none of
// that: it's just a visibility flag hiding an already-deactivated type from
// the main Jenis Absensi list, never touching a single historical record.
// `activeFlag` must already be false, same guard hard-delete had.
export async function archiveAbsenceTypeConfig(
  code: string,
  _prevState: string | undefined,
  _formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const type = await prisma.absenceTypeConfig.findUnique({ where: { code } });
  if (!type) return "Jenis absensi tidak ditemukan.";
  if (type.activeFlag) return "Nonaktifkan dahulu sebelum diarsipkan.";

  await prisma.absenceTypeConfig.update({ where: { code }, data: { archived: true } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceTypeConfig",
    recordId: code,
    reason: `Archived Absence type ${code} (${type.label})`,
  });

  revalidatePath("/admin/absence-settings");
}

export async function unarchiveAbsenceTypeConfig(
  code: string,
  _prevState: string | undefined,
  _formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const type = await prisma.absenceTypeConfig.findUnique({ where: { code } });
  if (!type) return "Jenis absensi tidak ditemukan.";

  await prisma.absenceTypeConfig.update({ where: { code }, data: { archived: false } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceTypeConfig",
    recordId: code,
    reason: `Unarchived Absence type ${code} (${type.label})`,
  });

  revalidatePath("/admin/absence-settings");
}

// Upsert-per-OrgUnit (any tier): an empty selection clears the configured
// approver (leaving that OrgUnit's Absence requests unable to reach that
// stage until HR Admin sets one) rather than leaving a dangling reference
// to a Position that was intentionally unset. `requiresSecondStage` is an
// explicit, per-unit opt-in into a 2nd stage (continuing up to the next
// configured ancestor above this one) — NOT implied by the parent
// Department also having its own row, which it usually needs regardless
// for employees who sit directly on it. See resolveAbsenceApprovalChain
// (absence-routing.ts).
export async function setAbsenceApproverConfig(
  orgUnitId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const approverPositionId = formData.get("approverPositionId") as string;
  const requiresSecondStage = formData.get("requiresSecondStage") === "on";

  if (!approverPositionId) {
    await prisma.absenceApproverConfig.deleteMany({ where: { orgUnitId } });
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "AbsenceApproverConfig",
      recordId: orgUnitId,
      reason: "Cleared configured approver Position",
    });
    revalidatePath("/admin/absence-settings");
    return undefined;
  }

  await prisma.absenceApproverConfig.upsert({
    where: { orgUnitId },
    create: { orgUnitId, approverPositionId, requiresSecondStage },
    update: { approverPositionId, requiresSecondStage },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceApproverConfig",
    recordId: orgUnitId,
    reason: `Set approver Position to ${approverPositionId}, requiresSecondStage=${requiresSecondStage}`,
  });

  revalidatePath("/admin/absence-settings");
}

// Jadwal Jam Kerja per Shift — per direct request ("this will need to be
// able to be configured within the apps if we decided to change it"): the
// scheduled-minutes-per-day source Total Jam Kerja reads from
// (attendance-hours.ts), never hardcoded. One form per Shift, one field per
// day-of-week (0=Sunday..6=Saturday), all 7 upserted together.
export async function updateWorkSchedule(
  shiftType: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";
  if (!VALID_SHIFT_TYPES.includes(shiftType as ShiftAssignmentType)) return "Shift tidak valid.";
  const validShiftType = shiftType as ShiftAssignmentType;

  const minutesByDay: number[] = [];
  for (let day = 0; day <= 6; day++) {
    const raw = (formData.get(`minutes_${day}`) as string)?.trim();
    const minutes = raw ? Number(raw) : 0;
    if (!Number.isFinite(minutes) || minutes < 0 || !Number.isInteger(minutes)) return "Jam kerja wajib berupa menit (angka bulat 0 atau lebih).";
    minutesByDay.push(minutes);
  }

  await prisma.$transaction(
    minutesByDay.map((minutes, day) =>
      prisma.workScheduleConfig.upsert({
        where: { shiftType_dayOfWeek: { shiftType: validShiftType, dayOfWeek: day } },
        create: { shiftType: validShiftType, dayOfWeek: day, minutes },
        update: { minutes },
      })
    )
  );

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "WorkScheduleConfig",
    recordId: shiftType,
    reason: `Updated schedule for ${shiftType}: ${minutesByDay.join(",")} minutes (Sun..Sat)`,
  });

  revalidatePath("/admin/absence-settings");
}

// Thin wrapper: the same setAbsenceQuotaOverride action used on the
// Employee detail page, just reading employeeId/absenceTypeCode from the
// form itself (picked via <select>s) instead of being pre-bound — this is
// the "add a new override" form's target, where the pair isn't known until
// submit. No override logic is duplicated; this only extracts the two
// fields and delegates.
export async function addAbsenceQuotaOverride(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const employeeId = formData.get("employeeId") as string;
  const absenceTypeCode = formData.get("absenceTypeCode") as string;
  if (!employeeId) return "Karyawan wajib dipilih.";
  if (!absenceTypeCode) return "Jenis Absensi wajib dipilih.";
  return setAbsenceQuotaOverride(employeeId, absenceTypeCode, undefined, formData);
}
