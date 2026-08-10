"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceAssignment } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { AttendanceMethod } from "@/generated/prisma/enums";

// Effective-dated, same shape as the Assignment/ShiftAssignment engines: the
// previous open-ended assignment (effectiveTo null) is closed off at the new
// assignment's start date rather than deleted, so assignment history is
// never lost.
export async function setAttendanceAssignment(
  employeeId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceAssignment(session)) return "Anda tidak memiliki akses.";

  const method = formData.get("method") as AttendanceMethod;
  const geofenceId = (formData.get("geofenceId") as string) || null;
  const fingerprintDeviceUserId = (formData.get("fingerprintDeviceUserId") as string)?.trim() || null;
  const effectiveFromRaw = formData.get("effectiveFrom") as string;

  if (method !== "MOBILE" && method !== "FINGERPRINT") return "Metode absensi wajib dipilih.";
  if (!effectiveFromRaw) return "Tanggal mulai berlaku wajib diisi.";
  if (method === "FINGERPRINT" && !fingerprintDeviceUserId) {
    return "ID Perangkat Fingerprint wajib diisi untuk metode Fingerprint (dipakai mencocokkan data impor).";
  }

  const effectiveFrom = new Date(effectiveFromRaw);

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return "Karyawan tidak ditemukan.";

  await prisma.$transaction(async (tx) => {
    await tx.attendanceAssignment.updateMany({
      where: { employeeId, effectiveTo: null },
      data: { effectiveTo: effectiveFrom },
    });

    await tx.attendanceAssignment.create({
      data: {
        employeeId,
        method,
        geofenceId,
        fingerprintDeviceUserId,
        effectiveFrom,
        assignedByAccountId: session.user.id,
      },
    });
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AttendanceAssignment",
    recordId: employeeId,
    reason: `Set attendance method to ${method} effective ${effectiveFrom.toISOString().slice(0, 10)}`,
  });

  revalidatePath(`/employees/${employeeId}`);
}
