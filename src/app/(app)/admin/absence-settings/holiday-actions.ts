"use server";

import { revalidatePath } from "next/cache";
import type { HolidayType } from "@/generated/prisma/enums";
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
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

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
  const blockedKeys = new Set(
    existing.filter((r) => r.absenceTypeCode || r.shiftType || r.presentOverride).map((r) => `${r.employeeId}:${r.attendanceDate.getTime()}`)
  );

  const now = new Date();
  const writes: (() => Promise<unknown>)[] = [];
  for (const v of valid) {
    const holidayData =
      holidayType === "TANGGAL_MERAH"
        ? { shiftType: "NON_SHIFT" as const, absenceTypeCode: null }
        : null;
    for (const employee of employees) {
      const key = `${employee.id}:${v.date!.getTime()}`;
      if (blockedKeys.has(key)) continue;
      const data = holidayData ?? { absenceTypeCode: "CTB", shiftType: assignedShiftFor(employee.id, normalizeWeekStart(v.date!)) };
      writes.push(() =>
        prisma.dailyAttendanceRecord.upsert({
          where: { employeeId_attendanceDate: { employeeId: employee.id, attendanceDate: v.date! } },
          create: {
            employeeId: employee.id,
            attendanceDate: v.date!,
            ...data,
            classificationNote: v.label,
            classifiedAt: now,
            classifiedByAccountId: session.user.id,
          },
          update: { ...data, classificationNote: v.label, classifiedAt: now, classifiedByAccountId: session.user.id },
        })
      );
    }
  }

  // Plain Promise.all in bounded chunks, not $transaction — same reasoning
  // as the CompanyHoliday upsert above: a full year x ~186 employees is
  // thousands of independent, idempotent writes, run concurrently in
  // batches rather than one giant sequential interactive transaction
  // (which would hit the same 5s timeout, just later).
  const CHUNK = 50;
  for (let i = 0; i < writes.length; i += CHUNK) {
    await Promise.all(writes.slice(i, i + CHUNK).map((run) => run()));
  }

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "CompanyHoliday",
    reason: `Added ${valid.length} ${holidayType} date(s), filled ${writes.length} employee-day(s) (${blockedKeys.size} already classified, skipped)`,
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
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

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
