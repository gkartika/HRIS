-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('TANGGAL_MERAH', 'CUTI_BERSAMA');

-- CreateTable
CREATE TABLE "CompanyHoliday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "holidayType" "HolidayType" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHoliday_date_key" ON "CompanyHoliday"("date");
