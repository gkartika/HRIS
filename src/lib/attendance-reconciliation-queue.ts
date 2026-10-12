import { prisma } from "@/lib/db";
import { companyToday, startOfCompanyDay, formatCompanyTime } from "@/lib/company-time";
import { buildPunchDayLookup, punchDayKey } from "@/lib/punch-days";
import type { CutoffPeriod } from "@/lib/absence-cutoff";
import {
  normalizeWeekStart,
  buildScheduleMinutesLookup,
  buildAssignedShiftLookup,
  buildIsScheduledToWorkLookup,
} from "@/lib/shift-assignment";
import { computeDayMinutes, computeActualDayMinutes } from "@/lib/attendance-hours";
import { pickLeaveRequestForGridDay } from "@/lib/leave-on-grid";
import { haversineDistanceMeters } from "@/lib/attendance";
import type { AutoDayVerdict } from "@/lib/attendance-auto-day";
import { loadAutoDayVerdicts } from "@/lib/attendance-auto-day-queries";

// Real punches for these employees in [start, end), read straight from the
// events so a check-in shows up the moment it is made (see punch-days.ts).
async function loadPunchDays(employeeIds: string[], start: Date, end: Date) {
  if (employeeIds.length === 0 || end <= start) return buildPunchDayLookup([]);
  const events = await prisma.attendanceEvent.findMany({
    where: {
      employeeId: { in: employeeIds },
      eventType: { in: ["CHECK_IN", "CHECK_OUT"] },
      eventAt: { gte: startOfCompanyDay(start), lt: startOfCompanyDay(end) },
    },
    select: { employeeId: true, eventType: true, eventAt: true },
  });
  return buildPunchDayLookup(events.map((e) => ({ ...e, eventType: e.eventType as "CHECK_IN" | "CHECK_OUT" })));
}

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

  // A day is only unresolved if neither the day's record NOR the live punch
  // events show a complete check-in + check-out.
  const punchDays = await loadPunchDays([...new Set(records.map((r) => r.employeeId))], period.start, queryEnd);
  const punched = (r: (typeof records)[number]) => {
    const p = punchDays.get(punchDayKey(r.employeeId, r.attendanceDate));
    return { hasIn: !!r.checkInEventId || !!p?.hasCheckIn, hasOut: !!r.checkOutEventId || !!p?.hasCheckOut };
  };
  const unresolved = records.filter((r) => {
    const { hasIn, hasOut } = punched(r);
    return !(hasIn && hasOut) && !isCoveredByApprovedAbsence(r.employeeId, r.attendanceDate);
  });

  const weekStarts = [...new Set(unresolved.map((r) => normalizeWeekStart(r.attendanceDate).getTime()))].map((t) => new Date(t));
  const employeeIds = [...new Set(unresolved.map((r) => r.employeeId))];
  const shiftAssignments =
    weekStarts.length > 0 && employeeIds.length > 0
      ? await prisma.shiftAssignment.findMany({ where: { employeeId: { in: employeeIds }, weekStartDate: { in: weekStarts } } })
      : [];
  const assignedShiftFor = buildAssignedShiftLookup(shiftAssignments);

  // A day the automatic rule already made a Setengah Hari (checked in 4 hours or
  // more late) is decided, even without a check-out, so it is not asked again.
  const autoVerdicts = await loadAutoDayVerdicts({ start: period.start, end: queryEnd });
  const stillUnresolved = unresolved.filter((r) => {
    const v = autoVerdicts.get(punchDayKey(r.employeeId, r.attendanceDate));
    return !(v && !v.decided && v.kind === "HALF");
  });

  return stillUnresolved
    .map((r) => {
      const { hasIn, hasOut } = punched(r);
      return {
        employeeId: r.employeeId,
        employeeNumber: r.employee.employeeNumber,
        employeeName: r.employee.fullLegalName,
        departmentName: r.employee.currentPosition?.orgUnit.unitName ?? "—",
        date: r.attendanceDate,
        reason:
          !hasIn && !hasOut
            ? "Tidak ada check-in/check-out. Tidak ada Cuti/Izin disetujui untuk tanggal ini."
            : !hasIn
              ? "Check-out tercatat, tidak ada check-in. Tidak ada Cuti/Izin disetujui untuk tanggal ini."
              : "Check-in tercatat, tidak ada check-out. Tidak ada Cuti/Izin disetujui untuk tanggal ini.",
        assignedShiftType: assignedShiftFor(r.employeeId, normalizeWeekStart(r.attendanceDate)),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.employeeName.localeCompare(b.employeeName));
}

export interface GridDayCell {
  date: Date;
  shiftType: string | null;
  /** This employee's normal weekly ShiftAssignment for this date — the fallback used for hours/labeling when the day carries no explicit shiftType override. */
  assignedShiftType: string;
  absenceTypeCode: string | null;
  absenceTypeLabel: string | null;
  /** True when the leave type shown comes from an approved leave request, not from a classification HR entered on this day. */
  fromLeaveRequest: boolean;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  /** HR manually confirmed this day as present despite no punch (forgotten scan). */
  presentOverride: boolean;
  /** "Jam Kerja Gaji" contribution for this single day, in minutes — see attendance-hours.ts's computeDayMinutes. */
  minutes: number;
  /** "Jam Kerja Aktual" contribution for this single day, in minutes — see attendance-hours.ts's computeActualDayMinutes. */
  actualMinutes: number;
  /** Late or out-of-location verdict for this day (attendance-auto-day.ts), when it was flagged. */
  auto?: AutoDayVerdict;
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
  // Inclusive of today: HR checking the grid mid-period expects to see
  // today's own punches so far, not just completed days.
  const lastDayShown = period.end < today ? period.end : today;
  const queryEnd = new Date(lastDayShown.getTime() + 24 * 60 * 60 * 1000);

  const dayCount = Math.round((queryEnd.getTime() - period.start.getTime()) / (24 * 60 * 60 * 1000));
  const dates: Date[] = Array.from({ length: dayCount }, (_, i) => new Date(period.start.getTime() + i * 24 * 60 * 60 * 1000));
  const weekStarts = [...new Set(dates.map((d) => normalizeWeekStart(d).getTime()))].map((t) => new Date(t));

  const [employees, records, absenceTypes, workSchedule, shiftAssignments, punchDays, approvedRequests, holidays, autoVerdicts] = await Promise.all([
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
    loadPunchDays(employeeIds, period.start, queryEnd),
    // Approved leave shows on the grid by itself (decided 2026-10-08), so the
    // grid and the payroll Excel no longer depend on Admin SDM re-entering it.
    prisma.absenceRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: "APPROVED",
        startDate: { lt: queryEnd },
        endDate: { gte: period.start },
      },
      select: { employeeId: true, startDate: true, endDate: true, absenceTypeCode: true },
    }),
    prisma.companyHoliday.findMany({
      where: { date: { gte: period.start, lt: queryEnd } },
      select: { date: true },
    }),
    loadAutoDayVerdicts({ start: period.start, end: queryEnd, employeeIds }),
  ]);

  const labelByCode = new Map(absenceTypes.map((t) => [t.code, t.label]));
  const pointsByCode = new Map(absenceTypes.map((t) => [t.code, t.pointsWeight]));
  const hoursMultiplierByCode = new Map(absenceTypes.map((t) => [t.code, t.hoursMultiplier]));
  const scheduleMinutesFor = buildScheduleMinutesLookup(workSchedule);
  const assignedShiftFor = buildAssignedShiftLookup(shiftAssignments);
  const isScheduledToWork = buildIsScheduledToWorkLookup(holidays, workSchedule, shiftAssignments);
  const requestsByEmployee = new Map<string, typeof approvedRequests>();
  for (const request of approvedRequests) {
    const list = requestsByEmployee.get(request.employeeId) ?? [];
    list.push(request);
    requestsByEmployee.set(request.employeeId, list);
  }

  const recordsByEmployee = new Map<string, typeof records>();
  for (const r of records) {
    const list = recordsByEmployee.get(r.employeeId) ?? [];
    list.push(r);
    recordsByEmployee.set(r.employeeId, list);
  }

  return employees.map((employee) => {
    const employeeRecords = recordsByEmployee.get(employee.id) ?? [];
    const recordByDate = new Map(employeeRecords.map((r) => [r.attendanceDate.getTime(), r]));
    const employeeRequests = requestsByEmployee.get(employee.id) ?? [];

    let totalMinutes = 0;
    let totalActualMinutes = 0;
    const days = dates.map((date) => {
      const record = recordByDate.get(date.getTime());
      const punch = punchDays.get(punchDayKey(employee.id, date));
      // Either the day's record or a live punch event counts.
      const hasCheckIn = !!record?.checkInEventId || !!punch?.hasCheckIn;
      const hasCheckOut = !!record?.checkOutEventId || !!punch?.hasCheckOut;
      const assignedShiftType = assignedShiftFor(employee.id, normalizeWeekStart(date));
      // An approved leave request covers this day only when nobody has made an
      // explicit call for it (a classification by Admin SDM, or "Masuk"), the
      // person did not actually punch in and out, and it is a real working day
      // for them (not a day off or public holiday). Same precedence as the
      // mandays-lost report: what Admin SDM entered always wins.
      const leaveRequest = pickLeaveRequestForGridDay({
        date,
        hasExplicitAbsenceCode: !!record?.absenceTypeCode,
        presentOverride: !!record?.presentOverride,
        hasCheckIn,
        hasCheckOut,
        isScheduledToWork: isScheduledToWork(employee.id, date),
        requests: employeeRequests,
      });
      // Checked in 4 hours (half the schedule) or more late: Setengah Hari (SH),
      // decided at check-in. Never over a day somebody decided.
      const auto = autoVerdicts.get(punchDayKey(employee.id, date));
      const autoHalf = !!auto && !auto.decided && auto.kind === "HALF" && labelByCode.has("SH");
      const absenceTypeCode = record?.absenceTypeCode ?? leaveRequest?.absenceTypeCode ?? (autoHalf ? "SH" : null);
      const hoursInput = {
        dayOfWeek: date.getUTCDay(),
        hasCheckIn,
        hasCheckOut,
        // With no punch to say which schedule applies, a leave day is paid on
        // the shift the person is rostered for that week (the weekly shift
        // assignment, Shift 1 when none), unless a shift was entered for the day.
        recordShiftType: record?.shiftType ?? (leaveRequest ? assignedShiftType : autoHalf ? auto!.shiftType : null),
        assignedShiftType,
        absenceTypeCode,
        hoursMultiplier: absenceTypeCode ? (hoursMultiplierByCode.get(absenceTypeCode) ?? 0) : 0,
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
        absenceTypeCode,
        absenceTypeLabel: absenceTypeCode ? (labelByCode.get(absenceTypeCode) ?? absenceTypeCode) : null,
        fromLeaveRequest: !!leaveRequest,
        hasCheckIn,
        hasCheckOut,
        presentOverride: !!record?.presentOverride,
        minutes,
        actualMinutes,
        auto,
      };
    });

    // Points follow the codes actually shown, leave requests included.
    const points = days.reduce((sum, d) => sum + (d.absenceTypeCode ? (pointsByCode.get(d.absenceTypeCode) ?? 0) : 0), 0);

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

export interface AttendanceNotice {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  date: Date;
  checkInTime: string | null;
  checkOutTime: string | null;
  late: boolean;
  outsideGeofence: boolean;
  /** Human-readable distance-from-site (or "within radius") note, for context — null when neither event captured a location at all. */
  locationNote: string | null;
  reason: string;
  /** What the automatic rule made of the day: still a full day, or a half day. */
  verdict: AutoDayVerdict;
}

// A day is listed when the check-in was late for the person's shift or outside
// every registered location. Informational: the outcome for hours and points
// comes from the automatic rule (attendance-auto-day.ts), shown next to each
// day. Lateness follows each shift's own start time and includes fingerprint
// punches; location only applies to mobile check-ins and never changes hours.
export async function getAttendanceNotices(period: CutoffPeriod): Promise<AttendanceNotice[]> {
  const now = new Date();
  const today = companyToday(now);
  const lastDayShown = period.end < today ? period.end : today;
  const queryEnd = new Date(lastDayShown.getTime() + 24 * 60 * 60 * 1000);
  if (queryEnd <= period.start) return [];

  const verdicts = await loadAutoDayVerdicts({ start: period.start, end: queryEnd });
  if (verdicts.size === 0) return [];

  const employeeIds = [...new Set([...verdicts.values()].map((v) => v.employeeId))];
  const [dayEvents, employees, geofences] = await Promise.all([
    // Every punch for the affected employees/period, not just the flagged
    // ones, so a flagged check-in is shown next to its normal check-out.
    prisma.attendanceEvent.findMany({
      where: { employeeId: { in: employeeIds }, eventType: { in: ["CHECK_IN", "CHECK_OUT"] }, eventAt: { gte: startOfCompanyDay(period.start), lt: startOfCompanyDay(queryEnd) } },
      orderBy: { eventAt: "asc" },
    }),
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, fullLegalName: true, currentPosition: { select: { orgUnit: { select: { unitName: true } } } } },
    }),
    prisma.attendanceGeofence.findMany({ where: { activeFlag: true } }),
  ]);

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  // Distance is never stored — recomputed here against today's active
  // geofences purely for display, same haversine check as the write path.
  const nearestGeofenceNote = (lat: number | null, lon: number | null): string | null => {
    if (lat === null || lon === null || geofences.length === 0) return null;
    let nearest = geofences[0];
    let nearestDistance = haversineDistanceMeters(lat, lon, nearest.latitude, nearest.longitude);
    for (const g of geofences.slice(1)) {
      const d = haversineDistanceMeters(lat, lon, g.latitude, g.longitude);
      if (d < nearestDistance) {
        nearest = g;
        nearestDistance = d;
      }
    }
    return nearestDistance >= 1000
      ? `${(nearestDistance / 1000).toFixed(1)} km dari ${nearest.siteName}`
      : `${Math.round(nearestDistance)} m dari ${nearest.siteName}`;
  };

  const byDay = new Map<string, typeof dayEvents>();
  for (const event of dayEvents) {
    const key = punchDayKey(event.employeeId, companyToday(event.eventAt));
    if (!verdicts.has(key)) continue;
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  const notices: AttendanceNotice[] = [];
  for (const [key, events] of byDay) {
    const verdict = verdicts.get(key)!;
    const employee = employeeById.get(verdict.employeeId);
    if (!employee) continue;
    const checkIn = events.find((e) => e.eventType === "CHECK_IN") ?? null;
    const checkOut = [...events].reverse().find((e) => e.eventType === "CHECK_OUT") ?? null;
    const outside = events.find((e) => e.withinGeofence === false);
    const locationNote = outside
      ? (nearestGeofenceNote(outside.latitude, outside.longitude) ?? "Di luar lokasi terdaftar")
      : events.some((e) => e.withinGeofence === true)
        ? "Dalam radius lokasi terdaftar"
        : null;
    const reason = events.map((e) => e.reason).filter((r): r is string => !!r).join(" / ") || "—";

    notices.push({
      employeeId: verdict.employeeId,
      employeeName: employee.fullLegalName,
      departmentName: employee.currentPosition?.orgUnit.unitName ?? "—",
      date: verdict.date,
      checkInTime: checkIn ? formatCompanyTime(checkIn.eventAt) : null,
      checkOutTime: checkOut ? formatCompanyTime(checkOut.eventAt) : null,
      late: verdict.late,
      outsideGeofence: verdict.outsideLocation,
      locationNote,
      reason,
      verdict,
    });
  }

  // Always newest first, per direct request.
  return notices.sort((a, b) => b.date.getTime() - a.date.getTime() || a.employeeName.localeCompare(b.employeeName));
}
