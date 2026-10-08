"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import type { HolidayType, ShiftAssignmentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseHolidayLines } from "@/lib/company-holiday";
import { normalizeWeekStart, buildAssignedShiftLookup } from "@/lib/shift-assignment";

// Bulk holiday calendar — per direct request: "input a year of national
// holiday in one go" instead of classifying every employee one by one.
// TANGGAL_MERAH fills every active employee's day with shiftType=NON_SHIFT
// (not a scheduled work day, same as a weekend); CUTI_BERSAMA fills the
// existing CTB absence type (paid, doesn't count toward mandays lost),
// using each employee's own assigned shift so its hours actually get
// credited (CTB's hoursMultiplier only applies with an explicit shift on
// the entry, same "shift and category together" rule as everywhere else).
//
// Deliberately never overwrites a day that's already classified — a real
// absence, an HR shift override, or a "Masuk" — since this only exists to
// save the one-by-one tedium for days that would otherwise all need
// identical treatment, not to clobber an exception HR already recorded.
export async function addCompanyHolidays(
  holidayType: HolidayType,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return t("common.forbidden");

  const text = (formData.get("lines") as string) ?? "";
  const { valid, errors } = parseHolidayLines(text);
  if (errors.length > 0) return errors.join("; ");
  if (valid.length === 0) return "Masukkan minimal satu tanggal.";

  const dates = valid.map((v) => v.date!);
  const weekStarts = [...new Set(dates.map((d) => normalizeWeekStart(d).getTime()))].map((t) => new Date(t));

  const [employees, shiftAssignments] = await Promise.all([
    prisma.employee.findMany({ where: { activeFlag: true }, select: { id: true } }),
    holidayType === "CUTI_BERSAMA"
      ? prisma.shiftAssignment.findMany({ where: { weekStartDate: { in: weekStarts } } })
      : Promise.resolve([]),
  ]);
  const assignedShiftFor = buildAssignedShiftLookup(shiftAssignments);

  // Plain Promise.all, not $transaction — the remote (Supabase) round trip
  // per upsert means a full year's worth of dates/employees easily exceeds
  // Prisma's 5s interactive-transaction timeout when run as one sequential
  // transaction. Atomicity isn't needed here: each upsert is independent
  // and idempotent, so a partial failure is simply re-run, not corrupted.
  await Promise.all(
    valid.map((v) =>
      prisma.companyHoliday.upsert({
        where: { date: v.date! },
        create: { date: v.date!, label: v.label, holidayType },
        update: { label: v.label, holidayType },
      })
    )
  );

  const existing = await prisma.dailyAttendanceRecord.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) }, attendanceDate: { in: dates } },
    select: { employeeId: true, attendanceDate: true, absenceTypeCode: true, shiftType: true, presentOverride: true },
  });
  const existingKeys = new Set(existing.map((r) => `${r.employeeId}:${r.attendanceDate.getTime()}`));
  const blockedKeys = new Set(
    existing.filter((r) => r.absenceTypeCode || r.shiftType || r.presentOverride).map((r) => `${r.employeeId}:${r.attendanceDate.getTime()}`)
  );

  const now = new Date();
  type HolidayData = { shiftType: ShiftAssignmentType | null; absenceTypeCode: string | null };
  // Employee-days to fill, grouped by (date, label, data) so each group is
  // one createMany (new rows) and one updateMany (rows that exist but carry
  // no classification yet) instead of one upsert per employee-day.
  const groups = new Map<string, { date: Date; label: string; data: HolidayData; create: string[]; update: string[] }>();
  let filled = 0;
  for (const v of valid) {
    const holidayData =
      holidayType === "TANGGAL_MERAH"
        ? { shiftType: "NON_SHIFT" as const, absenceTypeCode: null }
        : null;
    for (const employee of employees) {
      const key = `${employee.id}:${v.date!.getTime()}`;
      if (blockedKeys.has(key)) continue;
      const data: HolidayData = holidayData ?? { absenceTypeCode: "CTB", shiftType: assignedShiftFor(employee.id, normalizeWeekStart(v.date!)) };
      const groupKey = `${v.date!.getTime()}|${v.label}|${data.shiftType}|${data.absenceTypeCode}`;
      let group = groups.get(groupKey);
      if (!group) {
        group = { date: v.date!, label: v.label, data, create: [], update: [] };
        groups.set(groupKey, group);
      }
      (existingKeys.has(key) ? group.update : group.create).push(employee.id);
      filled++;
    }
  }

  // Bulk statements per group, in bounded concurrent chunks (not one big
  // interactive transaction, which would hit the 5s timeout). skipDuplicates
  // keeps a concurrent insert from failing the whole batch.
  const stamp = { classifiedAt: now, classifiedByAccountId: session.user.id };
  const statements: (() => Promise<unknown>)[] = [];
  for (const g of groups.values()) {
    const fields = { ...g.data, classificationNote: g.label, ...stamp };
    if (g.create.length > 0) {
      statements.push(() =>
        prisma.dailyAttendanceRecord.createMany({
          data: g.create.map((employeeId) => ({ employeeId, attendanceDate: g.date, ...fields })),
          skipDuplicates: true,
        })
      );
    }
    if (g.update.length > 0) {
      statements.push(() =>
        prisma.dailyAttendanceRecord.updateMany({ where: { attendanceDate: g.date, employeeId: { in: g.update } }, data: fields })
      );
    }
  }
  const CHUNK = 20;
  for (let i = 0; i < statements.length; i += CHUNK) {
    await Promise.all(statements.slice(i, i + CHUNK).map((run) => run()));
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "CompanyHoliday",
    reason: `Added ${valid.length} ${holidayType} date(s), filled ${filled} employee-day(s) (${blockedKeys.size} already classified, skipped)`,
  });

  revalidatePath("/admin/absence-settings");
  revalidatePath("/attendance/reconciliation");
  revalidatePath("/attendance/reconciliation/grid");
}

// Removes only the calendar config row — any DailyAttendanceRecord it
// already filled stays as historical record (HR can still correct
// individual days via Rekonsiliasi, same as any other classification).
export async function deleteCompanyHoliday(id: string, _prevState: string | undefined, _formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return t("common.forbidden");

  const holiday = await prisma.companyHoliday.findUnique({ where: { id } });
  if (!holiday) return "Tanggal tidak ditemukan.";

  await prisma.companyHoliday.delete({ where: { id } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "DELETE",
    datasetName: "CompanyHoliday",
    recordId: id,
    reason: `Removed holiday calendar entry ${holiday.date.toISOString().slice(0, 10)} — ${holiday.label}`,
  });

  revalidatePath("/admin/absence-settings");
}
