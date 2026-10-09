-- Additive only: three per-person switches for the pending-approvals number
-- (app icon, Beranda menu, browser tab title). On for everyone by default.
-- AlterTable
ALTER TABLE "Account" ADD COLUMN "notifyIconBadge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyMenuBadge" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyTabTitle" BOOLEAN NOT NULL DEFAULT true;
