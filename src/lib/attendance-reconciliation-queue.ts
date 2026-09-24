import { prisma } from "@/lib/db";
import { companyToday } from "@/lib/company-time";
import type { CutoffPeriod } from "@/lib/absence-cutoff";
import { normalizeWeekStart, buildScheduleMinutesLookup, buildAssignedShiftLookup } from "@/lib/shift-assignment";
import { computeDayMinutes, computeActualDayMinutes } from "@/lib/attendance-hours";

// Shared by Opsi A (the exception queue) and Opsi B (the full grid) so both
// surfaces read the "is this day already resolved" rule the same way —
// same reasoning as pending-approvals.ts's getPendingApprovals.

export interface UnresolvedDay {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string;
  date: Date;
  reason: string;
  /** This employee's normal weekly ShiftAssignment for this date — a
   *  sensible default to preselect when HR picks a shift for this entry,
   *  never assumed without being explicitly submitted (see
   *  attendance-hours.ts's "shift and category together" rule). */
  assignedShiftType: string;
}

// A day only needs HR's attention when there's no punch AND nothing already
// explains it (an approved Absence request, or a prior classification) —
// most employee-days need zero action, per direct request.
export async function getUnresolvedDays(period: CutoffPeriod): Promise<UnresolvedDay[]> {
  const now = new Date();
  const today = companyToday(now);
  const queryEnd = period.end < today ? new Date(period.end.getTime() + 24 * 60 * 60 * 1000) : today;
  if (queryEnd <= period.start) return [];

  const [records, approvedAbsences] = await Promise.all([
    prisma.dailyAttendanceRecord.findMany({
      where: {
        attendanceDate: { gte: period.start, lt: queryEnd },
        absenceTypeCode: null,
        presentOverride: false,
        // An explicit shift-only resolution (HR manually confirming a
        // shift with no absence code, or a holiday-calendar bulk fill
        // setting NON_SHIFT) means someone already made the call for this
        // day — it isn't unresolved just because there's no punch.
        shiftType: null,
        OR: [{ checkInEventId: null }, { checkOutEventId: null }],
        // An offboarded employee's old unpunched days aren't a real
        // exception needing HR's attention — exclude them, same active-only
        // scope as the grid's employee list.
        employee: { activeFlag: true },
      },
      select: {
        employeeId: true,
        attendanceDate: true,
        checkInEventId: true,
        checkOutEventId: true,
        employee: {
          select: {
            employeeNumber: true,
            fullLegalName: true,
            currentPosition: { select: { orgUnit: { select: { unitName: true } } } },
          },
        },
      },
      orderBy: [{ attendanceDate: "asc" }],
    }),
    prisma.absenceRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: period.end }, endDate: { gte: period.start } },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ]);

  const isCoveredByApprovedAbsence = (employeeId: string, date: Date) =>
    approvedAbsences.some((a) => a.employeeId === employeeId && a.startDate <= date && a.endDate >= date);

  const unresolved = records.filter((r) => !isCoveredByApprovedAbsence(r.employeeId, r.attendanceDate));

  const weekStarts = [...new Set(unresolved.map((r) => normalizeWeekStart(r.attendanceDate).getTime()))].map((t) => new Date(t));
  const employeeIds = [...new Set(unresolved.map((r) => r.employeeId))];
  const shiftAssignments =
    weekStarts.length > 0 && employeeIds.length > 0
      ? await prisma.shiftAssignment.findMany({ where: { employeeId: { in: employeeIds }, weekStartDate: { in: weekStarts } } })
      : [];
  const assignedShiftFor = buildAssignedShiftLookup(shiftAssignments);

  return unresolved
    .map((r) => ({
      employeeId: r.employeeId,
      employeeNumber: r.employee.employeeNumber,
      employeeName: r.employee.fullLegalName,
      departmentName: r.employee.currentPosition?.orgUnit.unitName ?? "—",
      date: r.attendanceDate,
      reason:
        !r.checkInEventId && !r.checkOutEventId
          ? "Tidak ada check-in/check-out. Tidak ada Cuti/Izin disetujui untuk tanggal ini."
          : !r.checkInEventId
            ? "Check-out tercatat, tidak ada check-in. Tidak ada Cuti/Izin disetujui untuk tanggal ini."
            : "Check-in tercatat, tidak ada check-out. Tidak ada Cuti/Izin disetujui untuk tanggal ini.",
      assignedShiftType: assignedShiftFor(r.employeeId, normalizeWeekStart(r.attendanceDate)),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.employeeName.localeCompare(b.employeeName));
}

export interface GridDayCell {
  date: Date;
  shiftType: string | null;
  /** This employee's normal weekly ShiftAssignment for this date — the fallback used for hours/labeling when the day carries no explicit shiftType override. */
  assignedShiftType: string;
  absenceTypeCode: string | null;
  absenceTypeLabel: string | null;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  /** HR manually confirmed this day as present despite no punch (forgotten scan). */
  presentOverride: boolean;
  /** "Jam Kerja Gaji" contribution for this single day, in minutes — see attendance-hours.ts's computeDayMinutes. */
  minutes: number;
  /** "Jam Kerja Aktual" contribution for this single day, in minutes — see attendance-hours.ts's computeActualDayMinutes. */
  actualMinutes: number;
}

export interface GridEmployeeRow {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string;
  /** Sum of pointsWeight across every classified day in this period. */
  points: number;
  /** Total "Jam Kerja Gaji" (salary hours) for the period, in minutes. */
  totalMinutes: number;
  /** Total "Jam Kerja Aktual" (real hours worked) for the period, in minutes — excludes paid-absence credit. */
  totalActualMinutes: number;
  days: GridDayCell[];
}

// Opsi B — the full period grid, every employee x every day, for checking
// and overriding what Opsi A (or the automatic punch match) already
// resolved. `employeeIds` narrows to one department/search result; the
// caller is expected to paginate/filter before calling this for a whole
// company-wide period, same reasoning as attendance/records already scoping
// its own employee list before computing rows.
export async function getReconciliationGrid(period: CutoffPeriod, employeeIds: string[]): Promise<GridEmployeeRow[]> {
  if (employeeIds.length === 0) return [];
  const now = new Date();
  const today = companyToday(now);
  const queryEnd = period.end < today ? new Date(period.end.getTime() + 24 * 60 * 60 * 1000) : today;

  const dayCount = Math.round((queryEnd.getTime() - period.start.getTime()) / (24 * 60 * 60 * 1000));
  const dates: Date[] = Array.from({ length: dayCount }, (_, i) => new Date(period.start.getTime() + i * 24 * 60 * 60 * 1000));
  const weekStarts = [...new Set(dates.map((d) => normalizeWeekStart(d).getTime()))].map((t) => new Date(t));

  const [employees, records, absenceTypes, workSchedule, shiftAssignments] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        employeeNumber: true,
        fullLegalName: true,
        currentPosition: { select: { orgUnit: { select: { unitName: true } } } },
      },
      orderBy: { fullLegalName: "asc" },
    }),
    queryEnd > period.start
      ? prisma.dailyAttendanceRecord.findMany({
          where: { employeeId: { in: employeeIds }, attendanceDate: { gte: period.start, lt: queryEnd } },
          select: {
            employeeId: true,
            attendanceDate: true,
            checkInEventId: true,
            checkOutEventId: true,
            shiftType: true,
            absenceTypeCode: true,
            presentOverride: true,
          },
        })
      : Promise.resolve([]),
    prisma.absenceTypeConfig.findMany({ select: { code: true, label: true, pointsWeight: true, hoursMultiplier: true } }),
    prisma.workScheduleConfig.findMany(),
    weekStarts.length > 0
      ? prisma.shiftAssignment.findMany({ where: { employeeId: { in: employeeIds }, weekStartDate: { in: weekStarts } } })
      : Promise.resolve([]),
  ]);

  const labelByCode = new Map(absenceTypes.map((t) => [t.code, t.label]));
  const pointsByCode = new Map(absenceTypes.map((t) => [t.code, t.pointsWeight]));
  const hoursMultiplierByCode = new Map(absenceTypes.map((t) => [t.code, t.hoursMultiplier]));
  const scheduleMinutesFor = buildScheduleMinutesLookup(workSchedule);
  const assignedShiftFor = buildAssignedShiftLookup(shiftAssignments);

  const recordsByEmployee = new Map<string, typeof records>();
  for (const r of records) {
    const list = recordsByEmployee.get(r.employeeId) ?? [];
    list.push(r);
    recordsByEmployee.set(r.employeeId, list);
  }

  return employees.map((employee) => {
    const employeeRecords = recordsByEmployee.get(employee.id) ?? [];
    const recordByDate = new Map(employeeRecords.map((r) => [r.attendanceDate.getTime(), r]));
    const points = employeeRecords.reduce((sum, r) => sum + (r.absenceTypeCode ? (pointsByCode.get(r.absenceTypeCode) ?? 0) : 0), 0);

    let totalMinutes = 0;
    let totalActualMinutes = 0;
    const days = dates.map((date) => {
      const record = recordByDate.get(date.getTime());
      const assignedShiftType = assignedShiftFor(employee.id, normalizeWeekStart(date));
      const hoursInput = {
        dayOfWeek: date.getUTCDay(),
        hasCheckIn: !!record?.checkInEventId,
        hasCheckOut: !!record?.checkOutEventId,
        recordShiftType: record?.shiftType ?? null,
        assignedShiftType,
        absenceTypeCode: record?.absenceTypeCode ?? null,
        hoursMultiplier: record?.absenceTypeCode ? (hoursMultiplierByCode.get(record.absenceTypeCode) ?? 0) : 0,
        presentOverride: !!record?.presentOverride,
      };
      const minutes = computeDayMinutes(hoursInput, scheduleMinutesFor);
      const actualMinutes = computeActualDayMinutes(hoursInput, scheduleMinutesFor);
      totalMinutes += minutes;
      totalActualMinutes += actualMinutes;
      return {
        date,
        shiftType: record?.shiftType ?? null,
        assignedShiftType,
        absenceTypeCode: record?.absenceTypeCode ?? null,
        absenceTypeLabel: record?.absenceTypeCode ? (labelByCode.get(record.absenceTypeCode) ?? record.absenceTypeCode) : null,
        hasCheckIn: !!record?.checkInEventId,
        hasCheckOut: !!record?.checkOutEventId,
        presentOverride: !!record?.presentOverride,
        minutes,
        actualMinutes,
      };
    });

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      employeeName: employee.fullLegalName,
      departmentName: employee.currentPosition?.orgUnit.unitName ?? "—",
      points,
      totalMinutes,
      totalActualMinutes,
      days,
    };
  });
}
