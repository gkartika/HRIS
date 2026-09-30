-- Split Employee.currentAddress (one free-text field) into structured
-- domisili + KTP address columns, with a flag for "KTP address same as
-- domisili" (the common case, defaults to true).

-- 1. Add the new columns.
ALTER TABLE "Employee"
  ADD COLUMN "currentAddressLine" TEXT,
  ADD COLUMN "currentAddressRtRw" TEXT,
  ADD COLUMN "currentAddressCity" TEXT,
  ADD COLUMN "currentAddressDistrict" TEXT,
  ADD COLUMN "currentAddressVillage" TEXT,
  ADD COLUMN "currentAddressPostalCode" TEXT,
  ADD COLUMN "idCardAddressSameAsCurrent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "idCardAddressLine" TEXT,
  ADD COLUMN "idCardAddressRtRw" TEXT,
  ADD COLUMN "idCardAddressCity" TEXT,
  ADD COLUMN "idCardAddressDistrict" TEXT,
  ADD COLUMN "idCardAddressVillage" TEXT,
  ADD COLUMN "idCardAddressPostalCode" TEXT;

-- 2. Preserve any existing free-text address by moving it into the new
-- "Alamat" line field, so no employee's existing address data is lost.
UPDATE "Employee" SET "currentAddressLine" = "currentAddress" WHERE "currentAddress" IS NOT NULL;

-- 3. Drop the old single free-text column.
ALTER TABLE "Employee" DROP COLUMN "currentAddress";
