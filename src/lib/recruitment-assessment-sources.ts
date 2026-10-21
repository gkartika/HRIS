import type { QuestionBankFile, RubricFile } from "./recruitment-assessment";
import bankJson from "./recruitment-assessment-data/cbp_v32_candidate_question_bank.json";
import rubricJson from "./recruitment-assessment-data/cbp_v32_hr_interpretation_rubric.json";

// The approved master-data package for assessment V3.2 / rubric V3.2-R1, exactly as supplied.
// The files in ./recruitment-assessment-data are never edited: a unit test hashes them and compares
// with the values below, so the question text, options, observations and scores stay traceable.
export const SOURCE_FILE_SHA256: Record<string, string> = {
  "cbp_v32_candidate_question_bank.json": "74073e025fa709a4b5c1b57ae89ba8cffe363bda815d2c4598d516dcab4a1d7a",
  "cbp_v32_hr_interpretation_rubric.json": "ae49f1a5cce6d84c5500f5b98ad1f55366bf9d84d4466fe22bf2ad840dccc517",
  "cbp_v32_hr_rubric_flat.csv": "e73211268cd1d9509f167d5d9f8d806b6fdb5f8c320ae4a1e2fc2e4051fa810e",
};

export const V32_QUESTION_BANK = bankJson as unknown as QuestionBankFile;
export const V32_RUBRIC_R1 = rubricJson as unknown as RubricFile;
