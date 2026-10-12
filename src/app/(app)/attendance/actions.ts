"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canRecordOwnAttendance } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { startOfCompanyDay, companyToday, DAY_MS } from "@/lib/company-time";
import { isLateForShift, isEventWithinAnyGeofence } from "@/lib/attendance";
import { DEFAULT_SHIFT_TYPE, normalizeWeekStart } from "@/lib/shift-assignment";
import { buildShiftStartLookup } from "@/lib/attendance-auto-day-queries";
import type { AttendanceEventType } from "@/generated/prisma/enums";

function todayRange(now: Date): { start: Date; end: Date } {
  const start = startOfCompanyDay(now);
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}

export async function recordAttendanceEvent(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) return "Akun Anda tidak terhubung ke data karyawan.";

  const assignment = await prisma.attendanceAssignment.findFirst({
    where: { employeeId, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!canRecordOwnAttendance(session, employeeId, assignment?.method ?? null)) {
    return "Anda tidak dapat mencatat absensi secara mandiri (metode absensi Anda bukan Mobile).";
  }

  const eventType = formData.get("eventType") as AttendanceEventType;
  if (eventType !== "CHECK_IN" && eventType !== "CHECK_OUT") return "Jenis absensi tidak valid.";

  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "Lokasi GPS tidak terdeteksi — ambil lokasi terlebih dahulu.";
  }

  const now = new Date();
  const { start, end } = todayRange(now);

  const existingSameType = await prisma.attendanceEvent.findFirst({
    where: { employeeId, eventType, eventAt: { gte: start, lt: end } },
  });
  if (existingSameType) {
    return eventType === "CHECK_IN" ? "Anda sudah check-in hari ini." : "Anda sudah check-out hari ini.";
  }

  // Per direct user request: check-out is allowed even with no check-in on
  // record today — never blocked, same "no restrictions" philosophy as time
  // and location. It's treated as an implicit late check-in below (a
  // check-out with nothing to pair it with reads as "they were here, they
  // just never punched in" rather than a genuinely missing day).
  const missingCheckInOnCheckOut =
    eventType === "CHECK_OUT" &&
    !(await prisma.attendanceEvent.findFirst({
      where: { employeeId, eventType: "CHECK_IN", eventAt: { gte: start, lt: end } },
    }));

  // Version after UAT: check-in/out is never blocked by time or location —
  // but a reason is required when either is off, so HR can see why in Rekap
  // Absensi rather than just that it happened.
  const activeGeofences = await prisma.attendanceGeofence.findMany({ where: { activeFlag: true } });
  // Late is judged against the start time of the shift this person is rostered
  // on this week (Shift 1 when nothing was assigned); a shift with no start
  // time set is never late.
  const [assignedShift, shiftStarts] = await Promise.all([
    prisma.shiftAssignment.findFirst({ where: { employeeId, weekStartDate: normalizeWeekStart(companyToday(now)) }, select: { shiftType: true } }),
    prisma.shiftStartConfig.findMany(),
  ]);
  const shiftStart = buildShiftStartLookup(shiftStarts)(assignedShift?.shiftType ?? DEFAULT_SHIFT_TYPE);
  const late = (eventType === "CHECK_IN" && isLateForShift(now, shiftStart)) || missingCheckInOnCheckOut;
  const withinGeofence = isEventWithinAnyGeofence({ latitude, longitude }, activeGeofences);
  const reason = (formData.get("reason") as string)?.trim() || null;

  if (!reason) {
    const triggers: string[] = [];
    if (late) triggers.push("terlambat");
    if (withinGeofence === false) triggers.push("berada di luar lokasi yang terdaftar");
    if (triggers.length > 0) {
      return `Anda ${triggers.join(" dan ")} — mohon isi kolom Alasan sebelum mengirim.`;
    }
  }

  const event = await prisma.attendanceEvent.create({
    data: {
      employeeId,
      attendanceAssignmentId: assignment!.id,
      eventType,
      eventSource: "MOBILE",
      eventAt: now,
      latitude,
      longitude,
      geofenceId: assignment!.geofenceId,
      reason,
      late,
      withinGeofence,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AttendanceEvent",
    recordId: event.id,
    reason: `${eventType} via Mobile`,
  });

  revalidatePath("/dashboard");
}
