-- Tambah Posisi: the request names a standard Jabatan and a unit instead of a position (the seat may need to be
-- created first). Additive only: two nullable columns with foreign keys.
ALTER TABLE "MovementRequest" ADD COLUMN "proposedJobId" TEXT;
ALTER TABLE "MovementRequest" ADD COLUMN "proposedOrgUnitId" TEXT;
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_proposedJobId_fkey" FOREIGN KEY ("proposedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MovementRequest" ADD CONSTRAINT "MovementRequest_proposedOrgUnitId_fkey" FOREIGN KEY ("proposedOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
