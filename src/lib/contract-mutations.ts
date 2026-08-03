// Shared Contract-row mutations reused by both the existing manual renewal
// pipeline (src/app/(app)/contracts/actions.ts) and the automated Contract
// Renewal Case workflow (src/app/(app)/contract-renewals/actions.ts) — a
// single new draft Contract is created the same way regardless of which
// workflow approved the renewal.
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { formatContractNumber } from "@/lib/contract";
import type { EmploymentStatus } from "@/generated/prisma/enums";

export async function nextContractNumber(contractType: EmploymentStatus): Promise<string> {
  const year = new Date().getFullYear();
  const countThisYear = await prisma.contract.count({
    where: { contractNumber: { startsWith: `${contractType}/CBP/${year}/` } },
  });
  return formatContractNumber(contractType, countThisYear + 1, year);
}

export async function createRenewalDraftContract(params: {
  oldContractId: string;
  employeeId: string;
  contractType: EmploymentStatus;
  startDate: Date;
  endDate: Date | null;
  actorAccountId: string;
  buildAuditReason: (contractNumber: string) => string;
}): Promise<{ id: string; contractNumber: string }> {
  const contractNumber = await nextContractNumber(params.contractType);
  const newContract = await prisma.contract.create({
    data: {
      contractNumber,
      employeeId: params.employeeId,
      contractType: params.contractType,
      startDate: params.startDate,
      endDate: params.endDate,
      status: "DRAFT",
      draftedAt: new Date(),
      renewedFromContractId: params.oldContractId,
    },
  });

  await logAudit({
    actorAccountId: params.actorAccountId,
    action: "CREATE",
    datasetName: "Contract",
    recordId: newContract.id,
    reason: params.buildAuditReason(contractNumber),
  });

  return { id: newContract.id, contractNumber: newContract.contractNumber };
}
