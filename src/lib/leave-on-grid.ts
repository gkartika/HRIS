// Pure rule for showing an approved leave request on the attendance grid (and
// so in the payroll Excel). No Prisma imports; tested in leave-on-grid.test.ts.

export interface LeaveRequestRange {
  startDate: Date;
  endDate: Date;
  absenceTypeCode: string;
}

// An approved leave request covers a grid day (decided 2026-10-08) only when:
//  - nobody has made an explicit call for that day: no absence code classified
//    by Admin SDM and no "Masuk (Lupa Absen)" override (what Admin SDM entered
//    always wins, the same precedence the mandays-lost report uses);
//  - the person did not actually punch in and out (they came to work);
//  - it is a real working day for them (not a day off or public holiday).
export function pickLeaveRequestForGridDay(args: {
  date: Date;
  hasExplicitAbsenceCode: boolean;
  presentOverride: boolean;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  isScheduledToWork: boolean;
  requests: LeaveRequestRange[];
}): LeaveRequestRange | undefined {
  if (args.hasExplicitAbsenceCode || args.presentOverride) return undefined;
  if (args.hasCheckIn && args.hasCheckOut) return undefined;
  if (!args.isScheduledToWork) return undefined;
  const time = args.date.getTime();
  return args.requests.find((r) => r.startDate.getTime() <= time && r.endDate.getTime() >= time);
}
