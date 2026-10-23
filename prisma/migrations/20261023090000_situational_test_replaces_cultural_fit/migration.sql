-- Tes Situasi Kerja is now the first test of every applicant (it replaced the Cultural Fit gate test).
-- The old Cultural Fit test is switched off, not deleted: it has no questions and no applicant ever took it,
-- and keeping the row keeps its history if one ever existed. Data only, no table changes.
UPDATE "RecruitmentTestType" SET "isGate" = false, "active" = false WHERE "id" = 'rtt_cultural_fit';
