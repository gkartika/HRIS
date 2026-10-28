// The seats Admin SDM or Admin Rekrutmen can pick when carrying out a Perubahan Posisi that named a Jabatan and a unit.
// A Mutasi, Promosi or Demosi moves the employee into a seat nobody holds as their main placement (a holder who is
// leaving does not block it); Tambah Posisi may also use a seat that already has a holder. Promosi and Demosi also
// need the level that was named on the request.
import { prisma } from "@/lib/db";
import { formatDateMedium } from "@/lib/format";

export interface SeatChoice {
  id: string;
  label: string;
  heldByEmployee: boolean;
}

export async function listMovementSeatChoices(input: {
  jobId: string;
  orgUnitId: string;
  jobTitle: string;
  unitName: string;
  jobLevel: string | null;
  employeeId: string;
  addPosition: boolean;
}): Promise<SeatChoice[]> {
  const rows = await prisma.position.findMany({
    where: { jobId: input.jobId, orgUnitId: input.orgUnitId, archived: false },
    orderBy: { positionCode: "asc" },
    select: {
      id: true,
      positionCode: true,
      jobLevel: true,
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
      label: `${p.positionCode} — ${p.jobLevel} ${input.jobTitle} (${input.unitName})${
        p.assignments.length
          ? `, dipegang ${p.assignments
              .map((a) => a.employee.fullLegalName + (a.employee.offboardingCases[0]?.lastWorkingDay ? ` (keluar ${formatDateMedium(a.employee.offboardingCases[0].lastWorkingDay)})` : ""))
              .join(", ")}`
          : ", kosong"
      }`,
      heldByEmployee: p.assignments.some((a) => a.employeeId === input.employeeId),
    }));
}
