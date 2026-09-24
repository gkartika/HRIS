import { prisma } from "@/lib/db";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { logAudit } from "@/lib/audit";
import { formatRenewalCaseNumber, isRenewalDue } from "@/lib/contract-renewal";
import { createDraftEvaluation } from "@/lib/evaluation-create";

// LIF-08: idempotent D-30 scan, run once a day by the scheduled job
// (app/api/cron/daily). Creates a renewal case AND its linked Evaluation
// Draft together (LIF-08/DM-27) for every active contract that has come due
// and has none yet — draft creation alone does not notify evaluators or start
// their deadline (that only happens when HR Admin releases it). The unique
// constraint on ContractRenewalCase.currentContractId is the actual
// idempotency guarantee; the "no existing case" filter just skips the
// already-handled contracts. Not a server action on purpose: nothing a
// browser can call.
export async function runDueRenewalScan(): Promise<{ created: number }> {
  const candidates = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      endDate: { not: null },
      renewalCaseAsCurrentContract: { is: null },
    },
    include: { employee: true },
  });
  const due = candidates.filter((c) => c.endDate && isRenewalDue(c.endDate) && c.employee.currentPositionId);
  if (due.length === 0) return { created: 0 };

  // One query for everyone's Primary assignment instead of one per contract.
  const primaryAssignments = await prisma.assignment.findMany({
    where: { employeeId: { in: due.map((c) => c.employeeId) }, assignmentType: "PRIMARY", status: "ACTIVE" },
    select: { id: true, employeeId: true },
  });
  const primaryByEmployee = new Map(primaryAssignments.map((a) => [a.employeeId, a.id]));

  let created = 0;
  for (const contract of due) {
    const employee = contract.employee;
    const primaryAssignmentId = primaryByEmployee.get(employee.id);
    if (!primaryAssignmentId) continue;

    try {
      const evaluation = await createDraftEvaluation({
        employeeId: employee.id,
        purpose: "CONTRACT_RENEWAL",
        primaryAssignmentId,
        snapshotPositionId: employee.currentPositionId,
        createdByAccountId: null,
      });

      const year = companyYear();
      const seq = await nextSequence(`REN-${year}`);
      const renewalCase = await prisma.contractRenewalCase.create({
        data: {
          caseNumber: formatRenewalCaseNumber(seq, year),
          currentContractId: contract.id,
          employeeId: employee.id,
          primaryAssignmentId,
          snapshotPositionId: employee.currentPositionId as string,
          status: "TRIGGERED",
          evaluationId: evaluation.id,
        },
      });
      await logAudit({
        actorAccountId: null,
        action: "CREATE",
        datasetName: "ContractRenewalCase",
        recordId: renewalCase.id,
        reason: `Auto-triggered at D-30 for contract ${contract.contractNumber}, linked to ${evaluation.evaluationNumber}`,
      });
      created++;
    } catch {
      // Unique constraint on currentContractId — a case already exists
      // (LIF-08 idempotency); safe to ignore.
    }
  }
  return { created };
}
