-- CreateTable
CREATE TABLE "AbsenceQuotaOverride" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenceTypeCode" TEXT NOT NULL,
    "annualDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAccountId" TEXT NOT NULL,

    CONSTRAINT "AbsenceQuotaOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceQuotaOverride_employeeId_absenceTypeCode_key" ON "AbsenceQuotaOverride"("employeeId", "absenceTypeCode");

-- AddForeignKey
ALTER TABLE "AbsenceQuotaOverride" ADD CONSTRAINT "AbsenceQuotaOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceQuotaOverride" ADD CONSTRAINT "AbsenceQuotaOverride_absenceTypeCode_fkey" FOREIGN KEY ("absenceTypeCode") REFERENCES "AbsenceTypeConfig"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceQuotaOverride" ADD CONSTRAINT "AbsenceQuotaOverride_updatedByAccountId_fkey" FOREIGN KEY ("updatedByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

