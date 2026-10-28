import { describe, expect, it } from "vitest";
import { APPLICANT_EMAILS_ENABLED } from "./applicant-email";

describe("email to applicants", () => {
  it("is switched off until the owner says otherwise", () => {
    expect(APPLICANT_EMAILS_ENABLED).toBe(false);
  });
});
