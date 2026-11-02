-- New-asset needs: when GA Admin wrote down the SL number (procurementReference) for Procurement.
-- Additive only: one nullable column, no existing row changes.
ALTER TABLE "GaRequest" ADD COLUMN "procurementRequestedAt" TIMESTAMP(3);
