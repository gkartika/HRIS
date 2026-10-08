import { DAY_MS } from "@/lib/company-time";
import { prisma } from "@/lib/db";
import { MONTH_LABELS_ID } from "@/lib/absence-cutoff";
import { normalizeWeekStart, buildScheduleMinutesLookup, buildAssignedShiftLookup } from "@/lib/shift-assignment";
import { resolveDepartmentId } from "@/lib/level3-scope";
import type { ReportPeriod } from "@/lib/report-period";


// "cycle" shows one bucket per week within the payroll period — the
// weekly cadence the old spreadsheet ("mandays lost every week") used;
// "year" shows one bucket per month.
export type BucketGranularity = "week" | "month";

export interface ReportBucket {
  bucketStart: Date;
  label: string;
}

export interface DepartmentMandaysRow {
  departmentId: string;
  departmentName: string;
  byBucket: number[];
  total: number;
  /** Total scheduled working mandays for this department's active employees in the period — the % denominator. */
  scheduledTotal: number;
  /** total / scheduledTotal * 100, 0 when scheduledTotal is 0. */
  percent: number;
}

export interface TypeBreakdownRow {
  code: string;
  label: string;
  count: number;
}

export interface MandaysLostReport {
  buckets: ReportBucket[];
  departmentRows: DepartmentMandaysRow[];
  totalByBucket: number[];
  /** Scheduled working mandays (all active employees, company-wide) per bucket — the per-bucket % denominator. */
  scheduledByBucket: number[];
  /** totalByBucket[i] / scheduledByBucket[i] * 100, 0 when that bucket's scheduled total is 0. */
  percentByBucket: number[];
  grandTotal: number;
  grandScheduled: number;
  grandPercent: number;
  byType: TypeBreakdownRow[];
}

function formatWeekBucketLabel(bucketStart: Date): string {
  const bucketEnd = new Date(bucketStart.getTime() + 6 * DAY_MS);
  const startDay = bucketStart.getUTCDate();
  const endDay = bucketEnd.getUTCDate();
  const startMonth = MONTH_LABELS_ID[bucketStart.getUTCMonth()];
  const endMonth = MONTH_LABELS_ID[bucketEnd.getUTCMonth()];
  return startMonth === endMonth ? `${startDay}-${endDay} ${startMonth}` : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}

function formatMonthBucketLabel(bucketStart: Date): string {
  return `${MONTH_LABELS_ID[bucketStart.getUTCMonth()]} ${bucketStart.getUTCFullYear()}`;
}

// "Report 2026" replacement — per direct request, mandays lost per
// salary-cycle/year (see report-period.ts), plus the % of scheduled
// working days actually lost. A day only counts as lost when:
// 1. Its AbsenceTypeConfig has countsTowardTdl=true (per direct correction:
//    "only CT B (Cuti bersama) collective leaves don't count" — everything
//    else, including planned Cuti/Izin/Sakit, is a real manday lost).
// 2. It was actually a scheduled work day for that employee's shift that
//    day (WorkScheduleConfig minutes > 0) — a day off doesn't cost a
//    manday even if classified, and doesn't count toward the % denominator
//    either (every active employee's own scheduled days are the
//    denominator, not just the ones who lost time).
// 3. It is not a public holiday in the holiday calendar (decided
//    2026-10-08): Tanggal Merah AND Cuti Bersama are never working days, so
//    they are neither a lost manday (even inside an approved leave) nor part
//    of the scheduled days in the % denominator.
// A day can be "lost" two ways — HR's explicit Rekonsiliasi classification
// (DailyAttendanceRecord.absenceTypeCode), or an approved AbsenceRequest
// range — but never both for the same day: an explicit HR record for that
// day (a real classification OR a "Masuk" presentOverride correcting it)
// always wins over an AbsenceRequest's coverage, same precedence Opsi A/B
// already use elsewhere in this module.
export async function getMandaysLostReport(period: ReportPeriod, bucketBy: BucketGranularity = "week"): Promise<MandaysLostReport> {
  const dayCount = Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS) + 1;
  const dates: Date[] = Array.from({ length: dayCount }, (_, i) => new Date(period.start.getTime() + i * DAY_MS));
  const bucketKeyFor = (date: Date) =>
    bucketBy === "month" ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) : normalizeWeekStart(date).getTime();
  const bucketStartTimes = [...new Set(dates.map(bucketKeyFor))].sort((a, b) => a - b);
  const buckets: ReportBucket[] = bucketStartTimes.map((t) => ({
    bucketStart: new Date(t),
    label: bucketBy === "month" ? formatMonthBucketLabel(new Date(t)) : formatWeekBucketLabel(new Date(t)),
  }));
  const bucketIndexByStart = new Map(bucketStartTimes.map((t, i) => [t, i]));
  const bucketIndexForDate = (date: Date) => bucketIndexByStart.get(bucketKeyFor(date)) ?? -1;

  // Shift assignments are always looked up at week granularity (their own
  // storage unit), independent of bucketBy — a "week" view still needs the
  // one ShiftAssignment row covering its single week.
  const weekStartTimes = [...new Set(dates.map((d) => normalizeWeekStart(d).getTime()))];

  const [explicitRecords, absenceRequests, absenceTypes, workSchedule, shiftAssignments, employees, holidays] = await Promise.all([
    prisma.dailyAttendanceRecord.findMany({
      where: {
        attendanceDate: { gte: period.start, lte: period.end },
        OR: [{ absenceTypeCode: { not: null } }, { presentOverride: true }],
      },
      select: { employeeId: true, attendanceDate: true, absenceTypeCode: true },
    }),
    prisma.absenceRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: period.end }, endDate: { gte: period.start } },
      select: { employeeId: true, startDate: true, endDate: true, absenceTypeCode: true },
    }),
    prisma.absenceTypeConfig.findMany({ select: { code: true, label: true, countsTowardTdl: true } }),
    prisma.workScheduleConfig.findMany(),
    weekStartTimes.length > 0
      ? prisma.shiftAssignment.findMany({ where: { weekStartDate: { in: weekStartTimes.map((t) => new Date(t)) } } })
      : Promise.resolve([]),
    // The % denominator needs every active employee's scheduled days, not
    // just the ones who lost time — a narrower "only employees with a
    // record" query would silently overstate the rate. `select` (not
    // `include`) since only id + department are read below, not the
    // full ~30-column Employee row (NIK, bank account, addresses, ...).
    prisma.employee.findMany({
      where: { activeFlag: true },
      select: { id: true, currentPosition: { select: { orgUnitId: true } } },
    }),
    prisma.companyHoliday.findMany({
      where: { date: { gte: period.start, lte: period.end } },
      select: { date: true },
    }),
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const typeByCode = new Map(absenceTypes.map((t) => [t.code, t]));
  const scheduleMinutesFor = buildScheduleMinutesLookup(workSchedule);
  const assignedShiftFor = buildAssignedShiftLookup(shiftAssignments);
  const holidayTimes = new Set(holidays.map((h) => h.date.getTime()));
  const isScheduledWorkDay = (employeeId: string, date: Date) =>
    !holidayTimes.has(date.getTime()) &&
    scheduleMinutesFor(assignedShiftFor(employeeId, normalizeWeekStart(date)), date.getUTCDay()) > 0;

  // Walked up to the actual Department (not the raw Position.orgUnitId) —
  // now that Positions can sit at Section/Group/Team tiers below
  // Department (ORG-01 depth work), grouping by the raw orgUnitId would
  // fragment one department's totals across its own sub-units instead of
  // rolling them up together. Resolved once per distinct orgUnitId, not
  // per employee.
  const distinctOrgUnitIds = [...new Set(employees.map((e) => e.currentPosition?.orgUnitId).filter((id): id is string => !!id))];
  const departmentIdByOrgUnitId = new Map(
    await Promise.all(distinctOrgUnitIds.map(async (id) => [id, await resolveDepartmentId(id)] as const))
  );
  const resolvedDepartmentIds = [...new Set([...departmentIdByOrgUnitId.values()].filter((id): id is string => !!id))];
  const departmentUnits = await prisma.orgUnit.findMany({
    where: { id: { in: resolvedDepartmentIds } },
    select: { id: true, unitName: true },
  });
  const departmentNameById = new Map(departmentUnits.map((u) => [u.id, u.unitName]));

  const departmentOf = (employee: (typeof employees)[number]) => {
    const orgUnitId = employee.currentPosition?.orgUnitId;
    const departmentId = orgUnitId ? (departmentIdByOrgUnitId.get(orgUnitId) ?? null) : null;
    return {
      departmentId: departmentId ?? "none",
      departmentName: departmentId ? (departmentNameById.get(departmentId) ?? "Tanpa Departemen") : "Tanpa Departemen",
    };
  };

  const deptAccum = new Map<string, DepartmentMandaysRow>();
  const ensureDeptRow = (employee: (typeof employees)[number]) => {
    const { departmentId, departmentName } = departmentOf(employee);
    if (!deptAccum.has(departmentId)) {
      deptAccum.set(departmentId, {
        departmentId,
        departmentName,
        byBucket: new Array(buckets.length).fill(0),
        total: 0,
        scheduledTotal: 0,
        percent: 0,
      });
    }
    return deptAccum.get(departmentId)!;
  };

  // Denominator pass: every active employee's scheduled working days in the
  // period, regardless of whether they lost any of them — bucketed too, so
  // each week/month gets its own % denominator, not just the period total.
  const scheduledByBucket = new Array(buckets.length).fill(0);
  let grandScheduled = 0;
  for (const employee of employees) {
    const row = ensureDeptRow(employee);
    for (const date of dates) {
      if (isScheduledWorkDay(employee.id, date)) {
        row.scheduledTotal += 1;
        grandScheduled += 1;
        const bucketIdx = bucketIndexForDate(date);
        if (bucketIdx >= 0) scheduledByBucket[bucketIdx] += 1;
      }
    }
  }

  // Any day HR explicitly touched (a real classification, or a "Masuk"
  // presentOverride) takes precedence over an AbsenceRequest's coverage of
  // that same day, so a day is never counted twice.
  const explicitKeys = new Set(explicitRecords.map((r) => `${r.employeeId}:${r.attendanceDate.getTime()}`));

  const typeAccum = new Map<string, number>();
  const totalByBucket = new Array(buckets.length).fill(0);
  let grandTotal = 0;

  const addManday = (employeeId: string, date: Date, absenceTypeCode: string) => {
    const type = typeByCode.get(absenceTypeCode);
    if (!type || !type.countsTowardTdl) return;
    const employee = employeeById.get(employeeId);
    if (!employee) return;
    if (!isScheduledWorkDay(employeeId, date)) return;
    const bucketIdx = bucketIndexForDate(date);
    if (bucketIdx < 0) return;

    const row = ensureDeptRow(employee);
    row.byBucket[bucketIdx] += 1;
    row.total += 1;
    totalByBucket[bucketIdx] += 1;
    typeAccum.set(absenceTypeCode, (typeAccum.get(absenceTypeCode) ?? 0) + 1);
    grandTotal += 1;
  };

  for (const r of explicitRecords) {
    if (r.absenceTypeCode) addManday(r.employeeId, r.attendanceDate, r.absenceTypeCode);
  }

  for (const req of absenceRequests) {
    const rangeStart = req.startDate > period.start ? req.startDate : period.start;
    const rangeEnd = req.endDate < period.end ? req.endDate : period.end;
    for (let cursor = rangeStart; cursor <= rangeEnd; cursor = new Date(cursor.getTime() + DAY_MS)) {
      const key = `${req.employeeId}:${cursor.getTime()}`;
      if (!explicitKeys.has(key)) addManday(req.employeeId, cursor, req.absenceTypeCode);
    }
  }

  for (const row of deptAccum.values()) {
    row.percent = row.scheduledTotal > 0 ? (row.total / row.scheduledTotal) * 100 : 0;
  }
  const percentByBucket = totalByBucket.map((n, i) => (scheduledByBucket[i] > 0 ? (n / scheduledByBucket[i]) * 100 : 0));

  const departmentRows = [...deptAccum.values()].sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  const byType = [...typeAccum.entries()]
    .map(([code, count]) => ({ code, label: typeByCode.get(code)?.label ?? code, count }))
    .sort((a, b) => b.count - a.count);

  return {
    buckets,
    departmentRows,
    totalByBucket,
    scheduledByBucket,
    percentByBucket,
    grandTotal,
    grandScheduled,
    grandPercent: grandScheduled > 0 ? (grandTotal / grandScheduled) * 100 : 0,
    byType,
  };
}
