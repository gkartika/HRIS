import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Db = Pick<typeof prisma, "$queryRaw"> | Prisma.TransactionClient;

// Next number in a series ("OFB-2026" -> 1, 2, 3, …). One atomic
// INSERT … ON CONFLICT DO UPDATE … RETURNING, so concurrent callers each get
// their own value. Pass the transaction client when the number is created
// inside a transaction — a rolled-back save then gives its number back.
export async function nextSequence(key: string, db: Db = prisma): Promise<number> {
  const rows = await db.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "NumberSequence" ("key", "lastValue") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "lastValue" = "NumberSequence"."lastValue" + 1
    RETURNING "lastValue"`;
  return rows[0].lastValue;
}
