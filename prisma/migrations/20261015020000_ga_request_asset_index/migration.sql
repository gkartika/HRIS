-- Open-report lookup on Perlengkapan Saya and the duplicate-report check: requests by asset and status.
CREATE INDEX "GaRequest_assetId_status_idx" ON "GaRequest"("assetId", "status");
