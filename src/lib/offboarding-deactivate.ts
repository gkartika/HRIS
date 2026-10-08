import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { companyToday } from "@/lib/company-time";
import { logAudit } from "@/lib/audit";
import { syncPositionStatus } from "@/lib/position-occupancy";

type Tx = Prisma.TransactionClient;

// The "person has left" step of Exit Clearance: end every active placement as
// of the last working day (history is kept), mark the employee inactive and
// disable the login. Shared by Exit Clearance (when it runs after the last
// working day) and the nightly job (when it ran before).
export async function deactivateEmployee(
  tx: Tx,
  args: { employeeId: string; lastWorkingDay: Date }
): Promise<{ positionIds: string[]; accountDisabled: boolean }> {
  const assignments = await tx.assignment.findMany({
    where: { employeeId: args.employeeId, status: { in: ["ACTIVE", "SCHEDULED"] } },
    select: { id: true, positionId: true, status: true, effectiveFrom: true },
  });
  for (const assignment of assignments) {
    await tx.assignment.update({
      where: { id: assignment.id },
      // A scheduled move that never took effect is closed as an empty period
      // (it must not come alive after the person has left).
      data:
        assignment.status === "SCHEDULED"
          ? { status: "ENDED", effectiveTo: assignment.effectiveFrom }
          : { status: "ENDED", effectiveTo: args.lastWorkingDay },
    });
  }

  await tx.employee.update({
    where: { id: args.employeeId },
    data: { currentPositionId: null, activeFlag: false },
  });

  const account = await tx.account.findUnique({ where: { employeeId: args.employeeId }, select: { id: true } });
  if (account) {
    await tx.account.update({
      where: { id: account.id },
      data: { accountStatus: "DISABLED", accountDisabledAt: new Date() },
    });
  }

  return { positionIds: assignments.map((a) => a.positionId), accountDisabled: !!account };
}

// Nightly job (decided 2026-10-08): access ends with the last working day.
// 1. A case whose Exit Clearance was completed early: now that the last day
//    has passed, deactivate the employee.
// 2. A case still waiting for clearance after the last day: switch the login
//    off (the employee record stays until clearance is done, so asset
//    accountability is not lost).
// "Passed" means the company-local date is after the last working day, so the
// employee keeps access through the whole last day. Safe to run repeatedly.
export async function runOffboardingDeactivations(now: Date = new Date()): Promise<{
  deactivated: number;
  loginsDisabled: number;
}> {
  const today = companyToday(now);

  const completedAwaitingDeactivation = await prisma.offboardingCase.findMany({
    where: { status: "COMPLETED", lastWorkingDay: { lt: today }, employee: { activeFlag: true } },
    select: { id: true, caseNumber: true, employeeId: true, lastWorkingDay: true },
  });
  for (const offboardingCase of completedAwaitingDeactivation) {
    const result = await prisma.$transaction((tx) =>
      deactivateEmployee(tx, { employeeId: offboardingCase.employeeId, lastWorkingDay: offboardingCase.lastWorkingDay })
    );
    for (const positionId of result.positionIds) await syncPositionStatus(positionId);
    await logAudit({
      actorAccountId: null,
      action: "UPDATE",
      datasetName: "OffboardingCase",
      recordId: offboardingCase.id,
      reason: `${offboardingCase.caseNumber}: last working day passed, employee deactivated automatically (${result.positionIds.length} assignment(s) ended${result.accountDisabled ? ", account disabled" : ""})`,
    });
  }

  const stillPending = await prisma.offboardingCase.findMany({
    where: {
      status: "PENDING_CLEARANCE",
      lastWorkingDay: { lt: today },
      employee: { account: { is: { accountStatus: { not: "DISABLED" } } } },
    },
    select: { id: true, caseNumber: true, employee: { select: { account: { select: { id: true } } } } },
  });
  for (const offboardingCase of stillPending) {
    const accountId = offboardingCase.employee.account?.id;
    if (!accountId) continue;
    await prisma.account.update({
      where: { id: accountId },
      data: { accountStatus: "DISABLED", accountDisabledAt: new Date() },
    });
    await logAudit({
      actorAccountId: null,
      action: "UPDATE",
      datasetName: "OffboardingCase",
      recordId: offboardingCase.id,
      reason: `${offboardingCase.caseNumber}: last working day passed before Exit Clearance, login disabled automatically`,
    });
  }

  return { deactivated: completedAwaitingDeactivation.length, loginsDisabled: stillPending.length };
}
