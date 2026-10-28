// The seats Admin SDM or Admin Rekrutmen can pick when carrying out a Perubahan Posisi that named a Jabatan.
// The request names only the standard Jabatan (owner, 2026-10-28): which unit the seat is in is for Admin SDM to work out,
// so every seat of that Jabatan is offered, in any department, and each shows its own unit. A Mutasi, Promosi or Demosi
// moves the employee into a seat nobody holds as their main placement (a holder who is leaving does not block it);
// Tambah Posisi may also use a seat that already has a holder. Promosi and Demosi also need the level named on the request.
import { prisma } from "@/lib/db";
import { formatDateMedium } from "@/lib/format";

export interface SeatChoice {
  id: string;
  label: string;
  heldByEmployee: boolean;
}

export async function listMovementSeatChoices(input: {
  jobId: string;
  jobTitle: string;
  jobLevel: string | null;
  employeeId: string;
  addPosition: boolean;
}): Promise<SeatChoice[]> {
  const rows = await prisma.position.findMany({
    where: { jobId: input.jobId, archived: false },
    orderBy: [{ orgUnit: { unitName: "asc" } }, { positionCode: "asc" }],
    select: {
      id: true,
      positionCode: true,
      jobLevel: true,
      orgUnit: { select: { unitName: true } },
      assignments: {
        where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
        select: {
          employeeId: true,
          assignmentType: true,
          employee: { select: { fullLegalName: true, offboardingCases: { where: { status: "PENDING_CLEARANCE" }, select: { lastWorkingDay: true } } } },
        },
      },
    },
  });
  return rows
    .filter(
      (p) =>
        input.addPosition ||
        (!p.assignments.some((a) => a.assignmentType === "PRIMARY" && a.employee.offboardingCases.length === 0) && (!input.jobLevel || p.jobLevel === input.jobLevel))
    )
    .map((p) => ({
      id: p.id,
      label: `${p.positionCode} — ${p.jobLevel} ${input.jobTitle} (${p.orgUnit.unitName})${
        p.assignments.length
          ? `, dipegang ${p.assignments
              .map((a) => a.employee.fullLegalName + (a.employee.offboardingCases[0]?.lastWorkingDay ? ` (keluar ${formatDateMedium(a.employee.offboardingCases[0].lastWorkingDay)})` : ""))
              .join(", ")}`
          : ", kosong"
      }`,
      heldByEmployee: p.assignments.some((a) => a.employeeId === input.employeeId),
    }));
}
