-- Tambah Posisi: a new kind of Perubahan Posisi. The employee keeps their placement and also takes the
-- proposed position as an Additional placement. Additive only (a new enum value).
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'ADD_POSITION';
