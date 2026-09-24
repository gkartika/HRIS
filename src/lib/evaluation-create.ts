import { prisma } from "@/lib/db";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { logAudit } from "@/lib/audit";
import { formatEvaluationNumber } from "@/lib/evaluation";
import type { EvaluationPurpose } from "@/generated/prisma/enums";

// PER-07/WF-19/DEC-020: the ONE shared creator for every source workflow —
// Contract Renewal's D-30 trigger and Perubahan Posisi's submit action both
// call this directly (server-to-server, no client-reachable "request
// evaluation" button anywhere — ACC-16/17: "no requester-trigger control").
export async function createDraftEvaluation(params: {
  employeeId: string;
  purpose: EvaluationPurpose;
  primaryAssignmentId?: string | null;
  snapshotPositionId?: string | null;
  createdByAccountId?: string | null;
}): Promise<{ id: string; evaluationNumber: string }> {
  const year = companyYear();
  const seq = await nextSequence(`EVL-${year}`);
  const evaluationNumber = formatEvaluationNumber(seq, year);

  const evaluation = await prisma.evaluation.create({
    data: {
      evaluationNumber,
      employeeId: params.employeeId,
      purpose: params.purpose,
      status: "DRAFT",
      primaryAssignmentId: params.primaryAssignmentId ?? null,
      snapshotPositionId: params.snapshotPositionId ?? null,
      createdByAccountId: params.createdByAccountId ?? null,
    },
  });

  await logAudit({
    actorAccountId: params.createdByAccountId ?? null,
    action: "CREATE",
    datasetName: "Evaluation",
    recordId: evaluation.id,
    reason: `Draft ${evaluationNumber} created (purpose: ${params.purpose})`,
  });

  return { id: evaluation.id, evaluationNumber: evaluation.evaluationNumber };
}
