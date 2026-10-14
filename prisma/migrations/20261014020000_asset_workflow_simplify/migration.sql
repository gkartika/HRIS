-- Simplified asset workflow. Additive only: two new enum values and two plan columns.
ALTER TYPE "AssetStatus" ADD VALUE 'PENDING_DISPOSAL';
ALTER TYPE "GaRequestStatus" ADD VALUE 'COMPLETED';
ALTER TABLE "MaintenancePlan" ADD COLUMN "autoCreateWorkOrder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MaintenancePlan" ADD COLUMN "dueKm" INTEGER;
