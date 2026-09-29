-- Remove Employee.workEmail ("Email Kantor") — login now uses personalEmail only,
-- and the field wasn't used anywhere else.
ALTER TABLE "Employee" DROP COLUMN "workEmail";
