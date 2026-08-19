"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageGaApprovalConfig } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import type { GaApprovalType } from "@/generated/prisma/enums";

// Upsert-per-approvalType, same "empty selection clears the config" shape
// as setAbsenceApproverConfig. For NEW_ASSET_NEED specifically, clearing it
// means every future request of that type auto-progresses without approval
// ("Approval required? No" in the PDF) — LOSS_REVIEW/DISPOSAL decisions
// simply have no eligible approver and sit pending until reconfigured, same
// convention as every other unconfigured-Position gap in this app.
export async function setGaApprovalConfig(
  approvalType: GaApprovalType,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageGaApprovalConfig(session)) return "Anda tidak memiliki akses.";

  const approverPositionId = formData.get("approverPositionId") as string;

  if (!approverPositionId) {
    await prisma.gaApprovalConfig.deleteMany({ where: { approvalType } });
    await logAudit({
      actorAccountId: session.user.id,
      action: "UPDATE",
      datasetName: "GaApprovalConfig",
      recordId: approvalType,
      reason: `Cleared configured approver Position for ${approvalType}`,
    });
    revalidatePath("/admin/ga-approvals");
    return undefined;
  }

  await prisma.gaApprovalConfig.upsert({
    where: { approvalType },
    create: { approvalType, approverPositionId, updatedByAccountId: session.user.id },
    update: { approverPositionId, updatedByAccountId: session.user.id },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "GaApprovalConfig",
    recordId: approvalType,
    reason: `Set approver Position for ${approvalType} to ${approverPositionId}`,
  });

  revalidatePath("/admin/ga-approvals");
  return undefined;
}
