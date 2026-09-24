-- ShiftCode changes from ('SHIFT', 'NON_SHIFT') to ('SHIFT_1', 'SHIFT_2', 'SHIFT_3').
-- Hand-written so existing rows are mapped instead of failing the cast:
-- old values carried no shift number, so both map to SHIFT_1 (the default
-- shift). The RecruitmentRequest table was empty at the time this ran.

CREATE TYPE "ShiftCode_new" AS ENUM ('SHIFT_1', 'SHIFT_2', 'SHIFT_3');

ALTER TABLE "RecruitmentRequest"
  ALTER COLUMN "shiftCode" TYPE "ShiftCode_new"
  USING (
    CASE "shiftCode"::text
      WHEN 'SHIFT' THEN 'SHIFT_1'
      WHEN 'NON_SHIFT' THEN 'SHIFT_1'
    END
  )::"ShiftCode_new";

DROP TYPE "ShiftCode";
ALTER TYPE "ShiftCode_new" RENAME TO "ShiftCode";
