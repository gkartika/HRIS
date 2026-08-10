"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { AbsenceType } from "@/generated/prisma/enums";

export async function setAbsenceEntitlementConfig(
  absenceType: AbsenceType,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const annualDays = Number(formData.get("annualDays"));
  if (!Number.isFinite(annualDays) || annualDays < 0) return "Jumlah hari wajib diisi dengan angka 0 atau lebih.";

  await prisma.absenceEntitlementConfig.upsert({
    where: { absenceType },
    create: { absenceType, annualDays },
    update: { annualDays },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceEntitlementConfig",
    recordId: absenceType,
    reason: `Set ${absenceType} annual entitlement to ${annualDays} days`,
  });

  revalidatePath("/admin/absence-entitlements");
}
