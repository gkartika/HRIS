-- Perubahan Posisi names a standard Jabatan and a unit for every type. Promosi and Demosi also name the level they go to,
-- so that "up" or "down" can still be checked without a seat. Additive only: one nullable column.
ALTER TABLE "MovementRequest" ADD COLUMN "proposedJobLevel" TEXT;
