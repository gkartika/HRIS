import { prisma } from "@/lib/db";
import { companyToday } from "@/lib/company-time";
import { logAudit } from "@/lib/audit";
import { syncPositionStatus } from "@/lib/position-occupancy";

// A future-dated move keeps the old primary placement ACTIVE (with its end date
// set) and stores the new one as SCHEDULED. Everything that decides authority
// reads the dates (activeAssignmentWhere), so the switch happens at midnight on
// the effective date by itself. This nightly step makes the stored status and
// Employee.currentPositionId catch up: the new placement becomes ACTIVE, the
// one it replaces becomes ENDED, and the seats' Kosong/Terisi flags are
// refreshed. Safe to run repeatedly.
export async function applyDuePlacementChanges(now: Date = new Date()): Promise<{ activated: number }> {
  const today = companyToday(now);
  const due = await prisma.assignment.findMany({
    where: { status: "SCHEDULED", effectiveFrom: { lte: today } },
    select: { id: true, employeeId: true, positionId: true, assignmentType: true },
  });

  const positionIds = new Set<string>();
  for (const scheduled of due) {
    const endedPositionIds = await prisma.$transaction(async (tx) => {
      const replaced =
        scheduled.assignmentType === "PRIMARY"
          ? await tx.assignment.findMany({
              where: {
                employeeId: scheduled.employeeId,
                assignmentType: "PRIMARY",
                status: "ACTIVE",
                effectiveTo: { lte: today },
              },
              select: { id: true, positionId: true },
            })
          : [];
      for (const old of replaced) {
        await tx.assignment.update({ where: { id: old.id }, data: { status: "ENDED" } });
      }
      await tx.assignment.update({ where: { id: scheduled.id }, data: { status: "ACTIVE" } });
      if (scheduled.assignmentType === "PRIMARY") {
        await tx.employee.update({
          where: { id: scheduled.employeeId },
          data: { currentPositionId: scheduled.positionId },
        });
      }
      return replaced.map((r) => r.positionId);
    });

    positionIds.add(scheduled.positionId);
    for (const id of endedPositionIds) positionIds.add(id);
    await logAudit({
      actorAccountId: null,
      action: "UPDATE",
      datasetName: "Assignment",
      recordId: scheduled.id,
      reason: "Scheduled placement change took effect (nightly job)",
    });
  }

  for (const positionId of positionIds) await syncPositionStatus(positionId);
  return { activated: due.length };
}
