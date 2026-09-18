"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { setAbsenceQuotaOverride } from "../../employees/[id]/absence-quota-actions";

// Machine code derived from the admin-entered label so HR Admin never has to
// invent one themselves — uppercase/underscore slug, uniqueness-checked
// against existing codes (including inactive ones, since the code is the
// stable key every existing AbsenceRequest/AbsenceEntitlementConfig joins
// against and must never collide, even after a type is deactivated).
async function deriveUniqueCode(label: string): Promise<string> {
  const base = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let code = base || "JENIS";
  let suffix = 2;
  while (await prisma.absenceTypeConfig.findUnique({ where: { code } })) {
    code = `${base}_${suffix}`;
    suffix += 1;
  }
  return code;
}

export async function createAbsenceTypeConfig(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Nama jenis absensi wajib diisi.";
  const requiresFirstApproval = formData.get("requiresFirstApproval") === "on";

  const code = await deriveUniqueCode(label);
  const maxSortOrder = await prisma.absenceTypeConfig.aggregate({ _max: { sortOrder: true } });

  const created = await prisma.absenceTypeConfig.create({
    data: {
      code,
      label,
      requiresFirstApproval,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "AbsenceTypeConfig",
    recordId: created.id,
    reason: `Added Absence type ${code} (${label}), requiresFirstApproval=${requiresFirstApproval}`,
  });

  revalidatePath("/admin/absence-settings");
}

// One row, two models: AbsenceTypeConfig's shape/approval-chain fields and
// AbsenceEntitlementConfig's company-wide default quota, both keyed by the
// same absenceTypeCode — merged into a single save so HR Admin edits one
// row instead of two separate tables for the same type.
export async function updateAbsenceTypeAndQuota(
  absenceTypeCode: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Nama jenis absensi wajib diisi.";
  const requiresFirstApproval = formData.get("requiresFirstApproval") === "on";
  const activeFlag = formData.get("activeFlag") === "on";

  // Blank clears any company-wide default entirely (unlimited / not
  // configured — resolveAnnualQuota treats "no row" as unlimited). A number,
  // including 0, is a real enforced quota: 0 means nobody gets this type by
  // default, and HR Admin grants an actual quota per person via the
  // per-employee override.
  const annualDaysRaw = (formData.get("annualDays") as string)?.trim();
  let annualDays: number | null = null;
  if (annualDaysRaw) {
    annualDays = Number(annualDaysRaw);
    if (!Number.isFinite(annualDays) || annualDays < 0) return "Jatah tahunan wajib diisi dengan angka 0 atau lebih, atau dikosongkan.";
  }

  await prisma.$transaction(async (tx) => {
    await tx.absenceTypeConfig.update({ where: { code: absenceTypeCode }, data: { label, requiresFirstApproval, activeFlag } });
    if (annualDays === null) {
      await tx.absenceEntitlementConfig.deleteMany({ where: { absenceTypeCode } });
    } else {
      await tx.absenceEntitlementConfig.upsert({
        where: { absenceTypeCode },
        create: { absenceTypeCode, annualDays },
        update: { annualDays },
      });
    }
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceTypeConfig",
    recordId: absenceTypeCode,
    reason: `Updated ${absenceTypeCode}: label=${label}, requiresFirstApproval=${requiresFirstApproval}, activeFlag=${activeFlag}, annualDays=${annualDays ?? "unlimited"}`,
  });

  revalidatePath("/admin/absence-settings");
}

// Upsert-per-Department: an empty selection clears the configured
// approver (leaving that Department's Absence requests unable to reach the
// first-approval stage until HR Admin sets one) rather than leaving a
// dangling reference to a Position that was intentionally unset.
export async function setAbsenceApproverConfig(
  departmentId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageAttendanceMasterData(session)) return "Anda tidak memiliki akses.";

  const approverPositionId = formData.get("approverPositionId") as string;

  if (!approverPositionId) {
    await prisma.absenceApproverConfig.deleteMany({ where: { departmentId } });
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "AbsenceApproverConfig",
      recordId: departmentId,
      reason: "Cleared configured first-approver Position",
    });
    revalidatePath("/admin/absence-settings");
    return undefined;
  }

  await prisma.absenceApproverConfig.upsert({
    where: { departmentId },
    create: { departmentId, approverPositionId },
    update: { approverPositionId },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "AbsenceApproverConfig",
    recordId: departmentId,
    reason: `Set first-approver Position to ${approverPositionId}`,
  });

  revalidatePath("/admin/absence-settings");
}

// Thin wrapper: the same setAbsenceQuotaOverride action used on the
// Employee detail page, just reading employeeId/absenceTypeCode from the
// form itself (picked via <select>s) instead of being pre-bound — this is
// the "add a new override" form's target, where the pair isn't known until
// submit. No override logic is duplicated; this only extracts the two
// fields and delegates.
export async function addAbsenceQuotaOverride(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const employeeId = formData.get("employeeId") as string;
  const absenceTypeCode = formData.get("absenceTypeCode") as string;
  if (!employeeId) return "Karyawan wajib dipilih.";
  if (!absenceTypeCode) return "Jenis Absensi wajib dipilih.";
  return setAbsenceQuotaOverride(employeeId, absenceTypeCode, undefined, formData);
}
