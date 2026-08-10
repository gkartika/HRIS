"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canRecordOwnAttendance } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { savePrivateFile, randomStorageKey } from "@/lib/file-storage";
import { validateSelfieFile } from "@/lib/validation/employee-fields";
import type { AttendanceEventType } from "@/generated/prisma/enums";

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

function todayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
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

  const file = formData.get("selfie") as File | null;
  if (!file || file.size === 0) return "Foto selfie wajib diambil.";
  const validationError = validateSelfieFile({ name: file.name, type: file.type, size: file.size });
  if (validationError) return validationError;

  const now = new Date();
  const { start, end } = todayRange(now);

  const existingSameType = await prisma.attendanceEvent.findFirst({
    where: { employeeId, eventType, eventAt: { gte: start, lt: end } },
  });
  if (existingSameType) {
    return eventType === "CHECK_IN" ? "Anda sudah check-in hari ini." : "Anda sudah check-out hari ini.";
  }

  if (eventType === "CHECK_OUT") {
    const checkIn = await prisma.attendanceEvent.findFirst({
      where: { employeeId, eventType: "CHECK_IN", eventAt: { gte: start, lt: end } },
    });
    if (!checkIn) return "Anda belum check-in hari ini.";
  }

  const storageKey = randomStorageKey("attendance-selfie", getExtension(file.name));
  const bytes = Buffer.from(await file.arrayBuffer());
  await savePrivateFile(storageKey, bytes);

  const fileObject = await prisma.fileObject.create({
    data: {
      storageKey,
      originalFileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      sensitivity: "RESTRICTED",
      employeeId,
      uploadedByAccountId: session.user.id,
      category: "ATTENDANCE_SELFIE",
      confidential: true,
    },
  });

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
      selfieFileId: fileObject.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AttendanceEvent",
    recordId: event.id,
    reason: `${eventType} via Mobile`,
  });

  revalidatePath("/attendance");
}
