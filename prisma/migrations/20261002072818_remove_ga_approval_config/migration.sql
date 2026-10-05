/*
  Warnings:

  - You are about to drop the column `decisionPositionId` on the `DisposalCase` table. All the data in the column will be lost.
  - You are about to drop the column `decisionPositionId` on the `GaRequest` table. All the data in the column will be lost.
  - You are about to drop the column `lossReviewedPositionId` on the `GaRequest` table. All the data in the column will be lost.
  - You are about to drop the `GaApprovalConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DisposalCase" DROP CONSTRAINT "DisposalCase_decisionPositionId_fkey";

-- DropForeignKey
ALTER TABLE "GaApprovalConfig" DROP CONSTRAINT "GaApprovalConfig_approverPositionId_fkey";

-- DropForeignKey
ALTER TABLE "GaApprovalConfig" DROP CONSTRAINT "GaApprovalConfig_updatedByAccountId_fkey";

-- DropForeignKey
ALTER TABLE "GaRequest" DROP CONSTRAINT "GaRequest_decisionPositionId_fkey";

-- DropForeignKey
ALTER TABLE "GaRequest" DROP CONSTRAINT "GaRequest_lossReviewedPositionId_fkey";

-- AlterTable
ALTER TABLE "DisposalCase" DROP COLUMN "decisionPositionId";

-- AlterTable
ALTER TABLE "GaRequest" DROP COLUMN "decisionPositionId",
DROP COLUMN "lossReviewedPositionId";

-- DropTable
DROP TABLE "GaApprovalConfig";

-- DropEnum
DROP TYPE "GaApprovalType";
