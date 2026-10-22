"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/require-session";
import { getActiveHrManagerPositions } from "@/lib/hr-manager";
import { canApproveAssessmentRubric, canManageAssessmentRubric, canViewAssessmentRubric } from "@/lib/permissions";
import { createRubricRevision, importV32Package, transitionRubric, updateAssessmentTimeLimit, updateInterpretation } from "@/lib/recruitment-assessment-service";
import type { RubricAction } from "@/lib/recruitment-assessment";
import { t } from "@/lib/i18n/id";

type Result = string | undefined;

function refresh(rubricId?: string) {
  revalidatePath("/recruitment/assessment");
  if (rubricId) revalidatePath(`/recruitment/assessment/${rubricId}`);
}

// Who may take which step. Admin Rekrutmen prepares and submits; only an active HR Manager approves or returns;
// either of them may activate an approved rubric or archive one. The page hides buttons, this is the check.
async function who() {
  const session = await requireSession();
  const hrManagerIds = (await getActiveHrManagerPositions(session.user.employeeId)).map((p) => p.positionId);
  return {
    accountId: session.user.id,
    isAdmin: canManageAssessmentRubric(session),
    isManager: canApproveAssessmentRubric(hrManagerIds),
    mayView: canViewAssessmentRubric(session, hrManagerIds),
  };
}

export async function importPackageAction(): Promise<Result> {
  const me = await who();
  if (!me.isAdmin) return t("common.forbidden");
  const res = await importV32Package(me.accountId);
  refresh();
  return res.ok ? undefined : res.error;
}

export async function saveInterpretationAction(interpretationId: string, rubricId: string, _prev: Result, formData: FormData): Promise<Result> {
  const me = await who();
  if (!me.isAdmin) return t("common.forbidden");
  const res = await updateInterpretation(me.accountId, interpretationId, {
    observation: ((formData.get("observation") as string) ?? "").toString(),
    riskSignal: Number(formData.get("riskSignal")),
  });
  refresh(rubricId);
  return res.ok ? undefined : res.error;
}

export async function rubricStepAction(rubricId: string, action: RubricAction, note?: string): Promise<Result> {
  const me = await who();
  const allowed =
    action === "SUBMIT" ? me.isAdmin
    : action === "APPROVE" || action === "RETURN" ? me.isManager
    : me.isAdmin || me.isManager; // ACTIVATE, ARCHIVE
  if (!allowed) return t("common.forbidden");
  const res = await transitionRubric(rubricId, action, { accountId: me.accountId }, note);
  refresh(rubricId);
  return res.ok ? undefined : res.error;
}

export async function returnRubricAction(rubricId: string, _prev: Result, formData: FormData): Promise<Result> {
  return rubricStepAction(rubricId, "RETURN", ((formData.get("note") as string) ?? "").toString());
}

export async function approveRubricAction(rubricId: string, _prev: Result, formData: FormData): Promise<Result> {
  return rubricStepAction(rubricId, "APPROVE", ((formData.get("note") as string) ?? "").toString());
}

export async function createRevisionAction(fromRubricId: string): Promise<Result> {
  const me = await who();
  if (!me.isAdmin) return t("common.forbidden");
  const res = await createRubricRevision(me.accountId, fromRubricId);
  refresh();
  return res.ok ? undefined : res.error;
}

// How long applicants have for the assessment (minutes). Admin Rekrutmen only; running attempts keep their own limit.
export async function saveTimeLimitAction(versionId: string, _prev: Result, formData: FormData): Promise<Result> {
  const me = await who();
  if (!me.isAdmin) return t("common.forbidden");
  const res = await updateAssessmentTimeLimit(me.accountId, versionId, Number(((formData.get("minutes") as string) ?? "").trim()));
  refresh();
  return res.ok ? undefined : res.error;
}
