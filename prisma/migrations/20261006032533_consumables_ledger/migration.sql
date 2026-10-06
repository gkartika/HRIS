-- CreateEnum
CREATE TYPE "ConsumableCategory" AS ENUM ('APD', 'ATK');

-- CreateEnum
CREATE TYPE "ConsumableTxType" AS ENUM ('ISSUE', 'RECEIPT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ConsumableRecipientType" AS ENUM ('EMPLOYEE', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "ConsumableTxSource" AS ENUM ('APP', 'IMPORT');

-- CreateTable
CREATE TABLE "ConsumableItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" "ConsumableCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "openingStock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "replacementPeriodMonths" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdByAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumableItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableTransaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "ConsumableTxType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "ConsumableTxSource" NOT NULL DEFAULT 'APP',
    "recipientType" "ConsumableRecipientType",
    "employeeId" TEXT,
    "orgUnitId" TEXT,
    "recipientNameSnapshot" TEXT,
    "departmentNameSnapshot" TEXT,
    "purpose" TEXT,
    "beforePeriod" BOOLEAN NOT NULL DEFAULT false,
    "exceededStock" BOOLEAN NOT NULL DEFAULT false,
    "warningReason" TEXT,
    "batchId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "systemStockSnapshot" INTEGER,
    "physicalStock" INTEGER,
    "reason" TEXT,
    "recordedByAccountId" TEXT NOT NULL,
    "recordedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByAccountId" TEXT,
    "cancelReason" TEXT,

    CONSTRAINT "ConsumableTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsumableItem_itemCode_key" ON "ConsumableItem"("itemCode");

-- CreateIndex
CREATE INDEX "ConsumableItem_category_idx" ON "ConsumableItem"("category");

-- CreateIndex
CREATE INDEX "ConsumableTransaction_itemId_occurredAt_idx" ON "ConsumableTransaction"("itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "ConsumableTransaction_employeeId_itemId_occurredAt_idx" ON "ConsumableTransaction"("employeeId", "itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "ConsumableTransaction_type_occurredAt_idx" ON "ConsumableTransaction"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "ConsumableTransaction_batchId_idx" ON "ConsumableTransaction"("batchId");

-- AddForeignKey
ALTER TABLE "ConsumableItem" ADD CONSTRAINT "ConsumableItem_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConsumableItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_recordedByAccountId_fkey" FOREIGN KEY ("recordedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableTransaction" ADD CONSTRAINT "ConsumableTransaction_cancelledByAccountId_fkey" FOREIGN KEY ("cancelledByAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
