import { prisma } from "@/lib/db";
import { deriveDailyAttendanceExceptions, type AttendanceException } from "@/lib/attendance";
import { normalizeWeekStart, DEFAULT_SHIFT_TYPE } from "@/lib/shift-assignment";
import type { AttendanceMethod, ShiftAssignmentType, AbsenceType, AbsenceStatus } from "@/generated/prisma/enums";

// Any Absence status still "live" for overlap-blocking / display purposes —
// per direct user request, an Absence is shown here even before it's been
// approved, so a rejected/cancelled request must never linger in this list.
const ACTIVE_ABSENCE_STATUSES: AbsenceStatus[] = ["SUBMITTED", "PENDING_HR_ADMIN", "APPROVED"];

export interface ActiveAbsenceSummary {
  id: string;
  requestNumber: string;
  absenceType: AbsenceType;
  status: AbsenceStatus;
}

export interface AttendanceRecordRow {
  employeeId: string;
  employeeNumber: string;
  name: string;
  departmentName: string;
  hasAssignment: boolean;
  method: AttendanceMethod | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  exceptions: AttendanceException[];
  shiftType: ShiftAssignmentType;
  activeAbsence: ActiveAbsenceSummary | null;
}

// Shared by the Attendance Records page and its CSV export route so the two
// never drift out of sync on how exceptions are computed.
export async function computeAttendanceRecordsForDate(employeeIds: string[], date: Date): Promise<AttendanceRecordRow[]> {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  // Shift weeks and Absence date ranges are both stored as UTC-midnight
  // "date-only" values (same convention as normalizeWeekStart/the date
  // <input> parsing elsewhere) — a plain local-midnight Date would be off by
  // a day against them whenever the server's local timezone isn't UTC.
  const utcDay = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekStartDate = normalizeWeekStart(utcDay);

  const [employees, assignments, events, shiftAssignments, absences] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { currentPosition: { include: { orgUnit: true } } },
      orderBy: { fullLegalName: "asc" },
    }),
    prisma.attendanceAssignment.findMany({
      where: { employeeId: { in: employeeIds }, effectiveTo: null },
    }),
    prisma.attendanceEvent.findMany({
      where: { employeeId: { in: employeeIds }, eventAt: { gte: dayStart, lt: dayEnd } },
      include: { geofence: true },
    }),
    prisma.shiftAssignment.findMany({
      where: { employeeId: { in: employeeIds }, weekStartDate },
    }),
    prisma.absenceRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: { in: ACTIVE_ABSENCE_STATUSES },
        startDate: { lte: utcDay },
        endDate: { gte: utcDay },
      },
    }),
  ]);
  const assignmentByEmployeeId = new Map(assignments.map((a) => [a.employeeId, a]));
  const shiftByEmployeeId = new Map(shiftAssignments.map((s) => [s.employeeId, s]));
  const absenceByEmployeeId = new Map(absences.map((a) => [a.employeeId, a]));

  return employees.map((employee) => {
    const assignment = assignmentByEmployeeId.get(employee.id) ?? null;
    const checkInEvent = events.find((e) => e.employeeId === employee.id && e.eventType === "CHECK_IN") ?? null;
    const checkOutEvent = events.find((e) => e.employeeId === employee.id && e.eventType === "CHECK_OUT") ?? null;
    const activeAbsenceRequest = absenceByEmployeeId.get(employee.id) ?? null;

    const exceptions: AttendanceException[] = assignment
      ? deriveDailyAttendanceExceptions({
          attendanceDate: dayStart,
          checkInEvent: checkInEvent
            ? { eventAt: checkInEvent.eventAt, latitude: checkInEvent.latitude, longitude: checkInEvent.longitude, geofence: checkInEvent.geofence }
            : null,
          checkOutEvent: checkOutEvent
            ? { eventAt: checkOutEvent.eventAt, latitude: checkOutEvent.latitude, longitude: checkOutEvent.longitude, geofence: checkOutEvent.geofence }
            : null,
        })
      : [];

    return {
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber,
      name: employee.fullLegalName,
      departmentName: employee.currentPosition?.orgUnit.unitName ?? "—",
      hasAssignment: !!assignment,
      method: assignment?.method ?? null,
      checkInAt: checkInEvent?.eventAt ?? null,
      checkOutAt: checkOutEvent?.eventAt ?? null,
      exceptions,
      shiftType: shiftByEmployeeId.get(employee.id)?.shiftType ?? DEFAULT_SHIFT_TYPE,
      activeAbsence: activeAbsenceRequest
        ? {
            id: activeAbsenceRequest.id,
            requestNumber: activeAbsenceRequest.requestNumber,
            absenceType: activeAbsenceRequest.absenceType,
            status: activeAbsenceRequest.status,
          }
        : null,
    };
  });
}
