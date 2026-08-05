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

// Per direct user request (11_FIELD_MAP's primary_assignment_code): every
// new/generated Contract must capture the Assignment it belongs to, since
// an Employee may hold multiple Positions. This is the default resolver —
// the employee's current active Primary Assignment — used wherever a
// contract is created for the employee's existing Position; the one
// exception is contract generation right after a Mutasi/Demosi Movement
// executes, which uses that Movement's own implementedAssignmentId instead
// (the specific new Assignment the Movement created), not this lookup.
export async function getActivePrimaryAssignment(employeeId: string) {
  return prisma.assignment.findFirst({
    where: { employeeId, assignmentType: "PRIMARY", status: "ACTIVE" },
  });
}

export async function createRenewalDraftContract(params: {
  oldContractId: string;
  employeeId: string;
  contractType: EmploymentStatus;
  startDate: Date;
  endDate: Date | null;
  primaryAssignmentId: string;
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
      primaryAssignmentId: params.primaryAssignmentId,
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
