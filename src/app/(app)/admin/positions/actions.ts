"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { PositionType, PositionStatus } from "@/generated/prisma/enums";

export async function createPosition(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return t("common.forbidden");

  const positionCode = (formData.get("positionCode") as string)?.trim();
  const jobId = formData.get("jobId") as string;
  const jobLevel = (formData.get("jobLevel") as string)?.trim();
  const orgUnitId = formData.get("orgUnitId") as string;
  const positionType = formData.get("positionType") as PositionType;
  const reportsToPositionId = (formData.get("reportsToPositionId") as string) || null;
  const grantsHrManagerAccess = formData.get("grantsHrManagerAccess") === "on";

  if (!positionCode || !jobId || !jobLevel || !orgUnitId || !positionType) {
    return "Kode posisi, jabatan, level, unit organisasi, dan jenis posisi wajib diisi.";
  }

  const existing = await prisma.position.findUnique({ where: { positionCode } });
  if (existing) return `Kode posisi ${positionCode} sudah digunakan.`;

  const position = await prisma.position.create({
    data: {
      positionCode,
      jobId,
      jobLevel,
      orgUnitId,
      positionType,
      reportsToPositionId: reportsToPositionId || null,
      positionStatus: "VACANT",
      grantsHrManagerAccess,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "Position",
    recordId: position.id,
    reason: `Created position ${positionCode}`,
  });

  revalidatePath("/admin/positions");
  revalidatePath("/organization");
  redirect("/admin/positions");
}

// Archiving hides a defunct Position from every "pick a Position" dropdown
// (reportsTo, new Assignment, Movement, Recruitment fulfillment, Contract
// renewal, org chart) without deleting the row, since the many workflow
// tables above hold a non-cascading FK into it. Gated on Status Posisi
// already being Ditutup (CLOSED) — same "deactivate, then archive" two-step
// as Jenis Absensi — plus no active holder, so nothing currently relying on
// this seat gets hidden out from under it.
export async function archivePosition(
  positionId: string,
  _prevState: string | undefined,
  _formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return t("common.forbidden");

  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) return "Posisi tidak ditemukan.";
  if (position.positionStatus !== "CLOSED") {
    return "Ubah Status Posisi menjadi Ditutup terlebih dahulu sebelum mengarsipkan.";
  }

  const [activeAssignment, subordinateCount] = await Promise.all([
    prisma.assignment.findFirst({ where: { positionId, status: "ACTIVE" } }),
    prisma.position.count({ where: { reportsToPositionId: positionId } }),
  ]);
  if (activeAssignment) return "Posisi ini masih memiliki penempatan aktif — akhiri dahulu.";
  if (subordinateCount > 0) {
    return "Posisi lain masih melapor ke posisi ini — ubah dahulu sebelum mengarsipkan.";
  }

  await prisma.position.update({ where: { id: positionId }, data: { archived: true } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Position",
    recordId: positionId,
    reason: `Archived position ${position.positionCode}`,
  });

  revalidatePath("/admin/positions");
  revalidatePath(`/admin/positions/${positionId}`);
  revalidatePath("/organization");
}

export async function unarchivePosition(
  positionId: string,
  _prevState: string | undefined,
  _formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return t("common.forbidden");

  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) return "Posisi tidak ditemukan.";

  await prisma.position.update({ where: { id: positionId }, data: { archived: false } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Position",
    recordId: positionId,
    reason: `Unarchived position ${position.positionCode}`,
  });

  revalidatePath("/admin/positions");
  revalidatePath(`/admin/positions/${positionId}`);
  revalidatePath("/organization");
}

export async function updatePosition(
  positionId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return t("common.forbidden");

  const jobId = formData.get("jobId") as string;
  const jobLevel = (formData.get("jobLevel") as string)?.trim();
  const orgUnitId = formData.get("orgUnitId") as string;
  const positionType = formData.get("positionType") as PositionType;
  const positionStatus = formData.get("positionStatus") as PositionStatus;
  const reportsToPositionId = (formData.get("reportsToPositionId") as string) || null;
  const grantsHrManagerAccess = formData.get("grantsHrManagerAccess") === "on";

  if (!jobId || !jobLevel || !orgUnitId || !positionType || !positionStatus) {
    return "Jabatan, level, unit organisasi, jenis, dan status posisi wajib diisi.";
  }
  if (reportsToPositionId === positionId) {
    return "Posisi tidak dapat melapor ke dirinya sendiri.";
  }

  await prisma.position.update({
    where: { id: positionId },
    data: {
      jobId,
      jobLevel,
      orgUnitId,
      positionType,
      positionStatus,
      reportsToPositionId: reportsToPositionId || null,
      grantsHrManagerAccess,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "Position",
    recordId: positionId,
    reason: "Updated position",
  });

  revalidatePath("/admin/positions");
  revalidatePath("/organization");
  redirect("/admin/positions");
}
