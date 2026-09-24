import { prisma } from "@/lib/db";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { logAudit } from "@/lib/audit";
import { formatOffboardingCaseNumber, INITIAL_OFFBOARDING_CASE_STATUS } from "@/lib/offboarding";
import type { OffboardingReason } from "@/generated/prisma/enums";

// LIF-06/12: the ONE shared creator for every trigger — a reported
// resignation and Contract Renewal's non-renewal handoff (contracts/
// renewal-actions.ts's createOffboardingHandoff) both call this directly
// (server-to-server), same "one internal creator, no duplicated insert"
// pattern as evaluations/actions.ts's createDraftEvaluation.
export async function createOffboardingCaseInternal(params: {
  employeeId: string;
  reason: OffboardingReason;
  lastWorkingDay: Date;
  reportedByAccountId: string | null;
  managerNote?: string | null;
  exitReasonId?: string | null;
  sourceRenewalCaseId?: string | null;
}): Promise<{ id: string; caseNumber: string }> {
  const year = companyYear();
  const seq = await nextSequence(`OFB-${year}`);
  const caseNumber = formatOffboardingCaseNumber(seq, year);

  const created = await prisma.offboardingCase.create({
    data: {
      caseNumber,
      employeeId: params.employeeId,
      reason: params.reason,
      status: INITIAL_OFFBOARDING_CASE_STATUS,
      lastWorkingDay: params.lastWorkingDay,
      // Documented simplification (no explicit day-count rule exists for
      // offboarding, unlike Evaluation's WF-18 "5 working days") — clearance
      // is due by the last working day itself.
      clearanceDueDate: params.lastWorkingDay,
      reportedByAccountId: params.reportedByAccountId,
      managerNote: params.managerNote ?? null,
      exitReasonId: params.exitReasonId ?? null,
      sourceRenewalCaseId: params.sourceRenewalCaseId ?? null,
    },
  });

  await logAudit({
    actorAccountId: params.reportedByAccountId,
    action: "CREATE",
    datasetName: "OffboardingCase",
    recordId: created.id,
    reason: `${caseNumber} reported (reason: ${params.reason})`,
  });

  return { id: created.id, caseNumber: created.caseNumber };
}
