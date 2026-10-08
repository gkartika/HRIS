// Pure rules for when a change of primary placement takes effect. No Prisma
// imports, so they are unit tested with plain dates (placement-timing.test.ts).

// A move dated in the future must not cut the employee off from their current
// placement today (decided 2026-10-08, gap EMP-1). Dates are date-only values
// at UTC midnight, compared against today's company-local date.
export function isFutureDated(effectiveDate: Date, today: Date): boolean {
  return effectiveDate.getTime() > today.getTime();
}

// Only a move that REPLACES a current primary placement is scheduled. A first
// placement (nobody to replace) is created at once, as before: its own start
// date already decides when it counts, and nothing is lost in between.
export function shouldScheduleMove(args: { hasCurrentPrimary: boolean; effectiveDate: Date; today: Date }): boolean {
  return args.hasCurrentPrimary && isFutureDated(args.effectiveDate, args.today);
}
