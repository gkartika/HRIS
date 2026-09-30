-- Remove Position.approvedFte — purely informational, never enforced any
-- concurrent-holder rule (DM-07 "one Primary occupant per seat" already
-- governs that independently of this field), and not needed going forward.
ALTER TABLE "Position" DROP COLUMN "approvedFte";
