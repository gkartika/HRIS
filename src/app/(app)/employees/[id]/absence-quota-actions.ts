"use server";

import { t } from "@/lib/i18n/id";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

// Blank input clears any existing override (falls back to the company-wide
// AbsenceEntitlementConfig default for that type); a number upserts it.
// @@unique([employeeId, absenceTypeCode]) keeps this to one row per pair.
export async function setAbsenceQuotaOverride(
  employeeId: string,
  absenceTypeCode: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return t("common.forbidden");

  const raw = (formData.get("annualDays") as string)?.trim();

  if (!raw) {
    await prisma.absenceQuotaOverride.deleteMany({ where: { employeeId, absenceTypeCode } });
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "AbsenceQuotaOverride",
      recordId: `${employeeId}:${absenceTypeCode}`,
      reason: `Cleared ${absenceTypeCode} quota override for employee ${employeeId} — back to company default`,
    });
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/admin/absence-settings");
    return;
  }

  const annualDays = Number(raw);
  if (!Number.isFinite(annualDays) || annualDays < 0) return "Jumlah hari wajib diisi dengan angka 0 atau lebih.";

  await prisma.absenceQuotaOverride.upsert({
    where: { employeeId_absenceTypeCode: { employeeId, absenceTypeCode } },
    create: { employeeId, absenceTypeCode, annualDays, updatedByAccountId: session.user.id },
    update: { annualDays, updatedByAccountId: session.user.id },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceQuotaOverride",
    recordId: `${employeeId}:${absenceTypeCode}`,
    reason: `Set ${absenceTypeCode} quota override for employee ${employeeId} to ${annualDays} days`,
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/admin/absence-settings");
}
