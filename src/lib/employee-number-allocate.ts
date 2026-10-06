import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { nextSequence } from "@/lib/number-sequence";
import {
  EMPLOYEE_NUMBER_SEQUENCE_KEY,
  formatEmployeeNumber,
  parseEmployeeNumber,
} from "@/lib/employee-number";

type Db = typeof prisma | Prisma.TransactionClient;

// Highest CBP-number already on an employee (0 when none). Numbers in another
// format (old "0027", imported "EMP-9") are ignored.
async function highestUsed(db: Db): Promise<number> {
  const rows = await db.employee.findMany({
    where: { employeeNumber: { startsWith: "CBP-" } },
    select: { employeeNumber: true },
  });
  return rows.reduce((max, r) => Math.max(max, parseEmployeeNumber(r.employeeNumber) ?? 0), 0);
}

// What the next employee will most likely get, for the "Nomor karyawan" hint on
// the create forms. Read-only: nothing is reserved until the employee is saved.
export async function peekNextEmployeeNumber(): Promise<string> {
  const [seq, used] = await Promise.all([
    prisma.numberSequence.findUnique({ where: { key: EMPLOYEE_NUMBER_SEQUENCE_KEY } }),
    highestUsed(prisma),
  ]);
  return formatEmployeeNumber(Math.max(seq?.lastValue ?? 0, used) + 1);
}

// Reserve the next number. Call it inside the same transaction that creates the
// employee, so a failed save gives the number back. It never hands out a number
// an employee already holds (e.g. imported before this existed): the counter is
// first lifted to the highest CBP-number in use.
export async function allocateEmployeeNumber(db: Db): Promise<string> {
  const used = await highestUsed(db);
  await db.numberSequence.upsert({
    where: { key: EMPLOYEE_NUMBER_SEQUENCE_KEY },
    create: { key: EMPLOYEE_NUMBER_SEQUENCE_KEY, lastValue: used },
    update: {},
  });
  await db.$executeRaw`UPDATE "NumberSequence" SET "lastValue" = GREATEST("lastValue", ${used}) WHERE "key" = ${EMPLOYEE_NUMBER_SEQUENCE_KEY}`;
  const next = await nextSequence(EMPLOYEE_NUMBER_SEQUENCE_KEY, db);
  return formatEmployeeNumber(next);
}
