"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageAttendanceMasterData } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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
    revalidatePath("/admin/absence-approvers");
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

  revalidatePath("/admin/absence-approvers");
}
