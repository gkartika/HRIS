-- Counting how often each alternative set was handed out (and checking a test type before it is deleted) looks up by test type.
CREATE INDEX "RecruitmentCandidateTest_testTypeId_idx" ON "RecruitmentCandidateTest"("testTypeId");
