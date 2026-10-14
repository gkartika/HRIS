import { prisma } from "@/lib/db";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { logAudit } from "@/lib/audit";
import { formatDisposalCaseNumber } from "@/lib/ga-operations";
import type { DisposalReason } from "@/generated/prisma/enums";

// The ONE shared creator for every auto-draft trigger (maintenance
// BEYOND_REPAIR outcome, confirmed loss review) plus the manual OBSOLETE
// action below — same "one internal creator, no duplicated insert" pattern
// as offboarding's createOffboardingCaseInternal.
export async function createDisposalCaseInternal(params: {
  assetId: string;
  reason: DisposalReason;
  createdByAccountId: string;
  sourceWorkOrderId?: string | null;
  sourceGaRequestId?: string | null;
  proposalNote?: string | null;
}): Promise<{ id: string; caseNumber: string }> {
  const year = companyYear();
  const seq = await nextSequence(`DSP-${year}`);
  const caseNumber = formatDisposalCaseNumber(seq, year);

  const created = await prisma.disposalCase.create({
    data: {
      caseNumber,
      assetId: params.assetId,
      reason: params.reason,
      status: "DRAFT",
      sourceWorkOrderId: params.sourceWorkOrderId ?? null,
      sourceGaRequestId: params.sourceGaRequestId ?? null,
      proposalNote: params.proposalNote ?? null,
      createdByAccountId: params.createdByAccountId,
    },
  });

  // The asset waits for this case: blocked from placement, and clearly not "under repair".
  await prisma.fixedAsset.updateMany({
    where: { id: params.assetId, status: { notIn: ["RETIRED", "DISPOSED"] } },
    data: { status: "PENDING_DISPOSAL" },
  });

  await logAudit({
    actorAccountId: params.createdByAccountId,
    action: "CREATE",
    datasetName: "DisposalCase",
    recordId: created.id,
    reason: `${caseNumber} drafted (reason: ${params.reason})`,
  });

  return { id: created.id, caseNumber: created.caseNumber };
}
