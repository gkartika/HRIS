import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { companyYear } from "@/lib/company-time";
import { nextSequence } from "@/lib/number-sequence";
import { formatOnboardingCaseNumber } from "@/lib/onboarding";

type Db = typeof prisma | Prisma.TransactionClient;

// LIF-03: the ONE creator of an Onboarding Case, used by direct employee
// creation, "create employee from a recruitment request" and the manual
// "new case" form, so the case-number rule (ONB-<year>-<running number>, year of
// the planned start) lives in a single place. Pass the transaction client when
// it runs inside the same transaction as the employee insert.
export async function createOnboardingCase(
  employeeId: string,
  plannedStartDate: Date,
  db: Db = prisma
): Promise<{ id: string; caseNumber: string }> {
  const year = companyYear(plannedStartDate);
  const seq = await nextSequence(`ONB-${year}`, db);
  return db.onboardingCase.create({
    data: { caseNumber: formatOnboardingCaseNumber(seq, year), employeeId, plannedStartDate },
    select: { id: true, caseNumber: true },
  });
}
