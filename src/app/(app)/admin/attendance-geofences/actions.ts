"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export async function createGeofence(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const siteName = (formData.get("siteName") as string)?.trim();
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const radiusMeters = Number(formData.get("radiusMeters"));

  if (!siteName) return "Nama lokasi wajib diisi.";
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "Latitude dan longitude wajib diisi dengan angka.";
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return "Radius wajib diisi dengan angka lebih dari 0.";

  const existing = await prisma.attendanceGeofence.findUnique({ where: { siteName } });
  if (existing) return `"${siteName}" sudah ada dalam daftar.`;

  const geofence = await prisma.attendanceGeofence.create({
    data: { siteName, latitude, longitude, radiusMeters },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AttendanceGeofence",
    recordId: geofence.id,
    reason: `Added geofence "${siteName}"`,
  });

  revalidatePath("/admin/attendance-geofences");
  redirect("/admin/attendance-geofences");
}

export async function toggleGeofence(
  geofenceId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const activeFlag = formData.get("activeFlag") === "on";
  await prisma.attendanceGeofence.update({ where: { id: geofenceId }, data: { activeFlag } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AttendanceGeofence",
    recordId: geofenceId,
    reason: `Set active=${activeFlag}`,
  });

  revalidatePath("/admin/attendance-geofences");
}
