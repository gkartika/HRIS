"use server";

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
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const positionCode = (formData.get("positionCode") as string)?.trim();
  const jobId = formData.get("jobId") as string;
  const jobLevel = (formData.get("jobLevel") as string)?.trim();
  const orgUnitId = formData.get("orgUnitId") as string;
  const positionType = formData.get("positionType") as PositionType;
  const reportsToPositionId = (formData.get("reportsToPositionId") as string) || null;
  const approvedFte = Number(formData.get("approvedFte") ?? 1);
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
      approvedFte: Number.isFinite(approvedFte) && approvedFte > 0 ? approvedFte : 1,
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

export async function updatePosition(
  positionId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const jobId = formData.get("jobId") as string;
  const jobLevel = (formData.get("jobLevel") as string)?.trim();
  const orgUnitId = formData.get("orgUnitId") as string;
  const positionType = formData.get("positionType") as PositionType;
  const positionStatus = formData.get("positionStatus") as PositionStatus;
  const reportsToPositionId = (formData.get("reportsToPositionId") as string) || null;
  const approvedFte = Number(formData.get("approvedFte") ?? 1);
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
      approvedFte: Number.isFinite(approvedFte) && approvedFte > 0 ? approvedFte : 1,
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
