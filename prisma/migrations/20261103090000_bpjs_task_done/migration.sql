-- BPJS reminders on the Admin SDM Beranda: one table that remembers which reminder was marked "Sudah".
-- Additive only: one enum, one table, no change to existing data.
CREATE TYPE "BpjsTaskKind" AS ENUM ('REGISTER_NEW', 'MONTHLY_LIST', 'DEACTIVATE_KES', 'DEACTIVATE_TK', 'PAY_KES', 'PAY_TK');

CREATE TABLE "BpjsTaskDone" (
    "id" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "kind" "BpjsTaskKind" NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedByAccountId" TEXT NOT NULL,

    CONSTRAINT "BpjsTaskDone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BpjsTaskDone_taskKey_key" ON "BpjsTaskDone"("taskKey");
CREATE INDEX "BpjsTaskDone_kind_idx" ON "BpjsTaskDone"("kind");
