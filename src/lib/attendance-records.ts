import { prisma } from "@/lib/db";
import { deriveDailyAttendanceExceptions, type AttendanceException } from "@/lib/attendance";
import type { AttendanceMethod } from "@/generated/prisma/enums";

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
}

// Shared by the Attendance Records page and its CSV export route so the two
// never drift out of sync on how exceptions are computed.
export async function computeAttendanceRecordsForDate(employeeIds: string[], date: Date): Promise<AttendanceRecordRow[]> {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [employees, assignments, events] = await Promise.all([
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
  ]);
  const assignmentByEmployeeId = new Map(assignments.map((a) => [a.employeeId, a]));

  return employees.map((employee) => {
    const assignment = assignmentByEmployeeId.get(employee.id) ?? null;
    const checkInEvent = events.find((e) => e.employeeId === employee.id && e.eventType === "CHECK_IN") ?? null;
    const checkOutEvent = events.find((e) => e.employeeId === employee.id && e.eventType === "CHECK_OUT") ?? null;

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
      name: employee.preferredName ?? employee.fullLegalName,
      departmentName: employee.currentPosition?.orgUnit.unitName ?? "—",
      hasAssignment: !!assignment,
      method: assignment?.method ?? null,
      checkInAt: checkInEvent?.eventAt ?? null,
      checkOutAt: checkOutEvent?.eventAt ?? null,
      exceptions,
    };
  });
}
