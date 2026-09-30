-- Lets HR Admin archive a defunct Position (hide it from every "pick a
-- Position" dropdown) without deleting the row, since many tables hold a
-- non-cascading FK into Position.
ALTER TABLE "Position" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
