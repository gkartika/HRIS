-- Master Aset Tetap: three optional text fields. Additive only; existing rows stay as they are.
ALTER TABLE "FixedAsset" ADD COLUMN "modelBrand" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "specification" TEXT;
ALTER TABLE "FixedAsset" ADD COLUMN "assetNumber" TEXT;
