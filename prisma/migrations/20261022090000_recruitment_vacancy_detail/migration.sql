-- AlterTable
ALTER TABLE "RecruitmentRequest" ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publicRequirements" TEXT,
ADD COLUMN     "publicTitle" TEXT;

-- Vacancies already open for applicants keep showing what they showed so far (the request's own text),
-- until Admin Rekrutmen edits the detail.
UPDATE "RecruitmentRequest" SET "publicDescription" = "jobDescriptionSnapshot", "publicRequirements" = "specialCriteria" WHERE "openFor" <> 'NONE' AND "publicDescription" IS NULL;
