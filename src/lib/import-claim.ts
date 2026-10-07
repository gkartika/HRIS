import { prisma } from "@/lib/db";

// A batch that has been "Import"-ed may only be written by ONE run at a time.
// The first click claims it atomically (one UPDATE ... WHERE status is still
// claimable); a second click, a second tab, or a double submit finds it already
// claimed and does nothing. Without this, two overlapping runs both saw the same
// unposted rows and each created the employees again (duplicates).
//
// A run that died halfway (server timeout, closed laptop) leaves the batch in
// POSTING; after STALE_AFTER_MS it can be claimed again and simply carries on,
// because rows already written are skipped.
export const STALE_AFTER_MS = 10 * 60 * 1000;

export type ClaimResult = "claimed" | "in-progress" | "already-posted";

export async function claimImportBatch(batchId: string, now: Date = new Date()): Promise<ClaimResult> {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);
  const claimed = await prisma.importBatch.updateMany({
    where: {
      id: batchId,
      OR: [
        { importStatus: { in: ["UPLOADED", "VALIDATED", "NEEDS_FIX"] } },
        { importStatus: "POSTING", postingStartedAt: { lt: staleBefore } },
      ],
    },
    data: { importStatus: "POSTING", postingStartedAt: now },
  });
  if (claimed.count === 1) return "claimed";

  const current = await prisma.importBatch.findUnique({ where: { id: batchId }, select: { importStatus: true } });
  return current?.importStatus === "POSTED" ? "already-posted" : "in-progress";
}

// Give the batch back (an error stopped the run) so it can be retried.
export async function releaseImportBatch(batchId: string): Promise<void> {
  await prisma.importBatch.updateMany({
    where: { id: batchId, importStatus: "POSTING" },
    data: { importStatus: "VALIDATED", postingStartedAt: null },
  });
}
