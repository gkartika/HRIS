"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/require-session";
import { canManageMandatoryTrainingRule } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { applyMandatoryTrainingRule } from "@/lib/mandatory-training";
import type { MandatoryTargetType } from "@/generated/prisma/enums";

export async function createMandatoryTrainingRule(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageMandatoryTrainingRule(session)) return "Anda tidak memiliki akses.";

  const courseId = (formData.get("courseId") as string)?.trim();
  const targetType = formData.get("targetType") as MandatoryTargetType;
  if (!courseId) return "Pelatihan wajib dipilih.";
  if (!["EMPLOYEE", "DEPARTMENT", "JOB", "PRIMARY_POSITION", "EVERYONE"].includes(targetType)) return "Target tidak valid.";

  const targetEmployeeId = targetType === "EMPLOYEE" ? ((formData.get("targetEmployeeId") as string)?.trim() || null) : null;
  const targetDepartmentId = targetType === "DEPARTMENT" ? ((formData.get("targetDepartmentId") as string)?.trim() || null) : null;
  const targetJobId = targetType === "JOB" ? ((formData.get("targetJobId") as string)?.trim() || null) : null;
  const targetPositionId = targetType === "PRIMARY_POSITION" ? ((formData.get("targetPositionId") as string)?.trim() || null) : null;

  if (targetType === "EMPLOYEE" && !targetEmployeeId) return "Karyawan wajib dipilih.";
  if (targetType === "DEPARTMENT" && !targetDepartmentId) return "Departemen wajib dipilih.";
  if (targetType === "JOB" && !targetJobId) return "Jabatan Standar wajib dipilih.";
  if (targetType === "PRIMARY_POSITION" && !targetPositionId) return "Posisi wajib dipilih.";

  const rule = await prisma.mandatoryTrainingRule.create({
    data: {
      courseId,
      targetType,
      targetEmployeeId,
      targetDepartmentId,
      targetJobId,
      targetPositionId,
      createdByAccountId: session.user.id,
    },
  });

  await logAudit({
    actorAccountId: session.user.id,
    action: "CREATE",
    datasetName: "MandatoryTrainingRule",
    recordId: rule.id,
    reason: `Created mandatory training rule (${targetType}) for course ${courseId}`,
  });

  revalidatePath("/training/mandatory-rules");
  redirect("/training/mandatory-rules");
}

// TRN-13: idempotent — re-applying an already-applied rule assigns only
// newly-eligible Employees (e.g. someone who just joined the target
// Department), never duplicates an existing active assignment.
export async function applyMandatoryTrainingRuleAction(ruleId: string, _prevState: string | undefined): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageMandatoryTrainingRule(session)) return "Anda tidak memiliki akses.";

  const result = await applyMandatoryTrainingRule(ruleId, session.user.id);

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "MandatoryTrainingRule",
    recordId: ruleId,
    reason: `Applied rule: ${result.newlyAssigned} newly assigned, ${result.alreadyAssigned} already assigned of ${result.audienceSize} audience`,
  });

  revalidatePath("/training/mandatory-rules");
  redirect(`/training/mandatory-rules?applied=${result.newlyAssigned}`);
}

export async function deactivateMandatoryTrainingRule(ruleId: string, _prevState: string | undefined): Promise<string | undefined> {
  const session = await requireSession();
  if (!canManageMandatoryTrainingRule(session)) return "Anda tidak memiliki akses.";

  await prisma.mandatoryTrainingRule.update({ where: { id: ruleId }, data: { activeFlag: false } });

  await logAudit({
    actorAccountId: session.user.id,
    action: "UPDATE",
    datasetName: "MandatoryTrainingRule",
    recordId: ruleId,
    reason: "Deactivated mandatory training rule",
  });

  revalidatePath("/training/mandatory-rules");
  redirect("/training/mandatory-rules");
}
