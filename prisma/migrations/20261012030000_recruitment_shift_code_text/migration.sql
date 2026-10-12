-- Additive only: the shift field on a recruitment request is only text info and
-- is now chosen as "Shift" or "Non Shift". Existing requests keep SHIFT_1/2/3.
-- AlterEnum
ALTER TYPE "ShiftCode" ADD VALUE 'SHIFT';
ALTER TYPE "ShiftCode" ADD VALUE 'NON_SHIFT';
