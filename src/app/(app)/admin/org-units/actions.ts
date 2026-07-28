"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, canManageOrgStructure } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { UnitType } from "@/generated/prisma/enums";

export async function createOrgUnit(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const unitCode = (formData.get("unitCode") as string)?.trim();
  const unitName = (formData.get("unitName") as string)?.trim();
  const unitType = formData.get("unitType") as UnitType;
  const parentUnitId = (formData.get("parentUnitId") as string) || null;

  if (!unitCode || !unitName || !unitType) {
    return "Kode, nama, dan jenis unit wajib diisi.";
  }

  const existing = await prisma.orgUnit.findUnique({ where: { unitCode } });
  if (existing) return `Kode unit ${unitCode} sudah digunakan.`;

  const unit = await prisma.orgUnit.create({
    data: { unitCode, unitName, unitType, parentUnitId: parentUnitId || null },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "OrgUnit",
    recordId: unit.id,
    reason: `Created org unit ${unitName} (${unitCode})`,
  });

  revalidatePath("/admin/org-units");
  redirect("/admin/org-units");
}

export async function updateOrgUnit(
  unitId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageOrgStructure(session)) return "Anda tidak memiliki akses.";

  const unitName = (formData.get("unitName") as string)?.trim();
  const unitType = formData.get("unitType") as UnitType;
  const parentUnitId = (formData.get("parentUnitId") as string) || null;
  const activeFlag = formData.get("activeFlag") === "on";

  if (!unitName || !unitType) return "Nama dan jenis unit wajib diisi.";
  if (parentUnitId === unitId) return "Unit tidak dapat menjadi induk dirinya sendiri.";

  await prisma.orgUnit.update({
    where: { id: unitId },
    data: { unitName, unitType, parentUnitId: parentUnitId || null, activeFlag },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "OrgUnit",
    recordId: unitId,
    reason: `Updated org unit ${unitName}`,
  });

  revalidatePath("/admin/org-units");
  redirect("/admin/org-units");
}
