import { describe, it, expect } from "vitest";
import { isEmployeeProfileIncomplete, missingFieldLabels } from "./employee-completeness";

const complete = {
  noKk: "3374010101880001",
  namaIbuKandung: "Sri Wahyuni",
  educationLevelId: "edu-1",
  ptkpStatusCode: "K/1",
  ktpFileId: "file-1",
  kkFileId: "file-2",
};

describe("isEmployeeProfileIncomplete", () => {
  it("returns false when all six DM-17/DM-18/DM-19/DM-20 fields are present", () => {
    expect(isEmployeeProfileIncomplete(complete)).toBe(false);
  });

  it("returns true when any single field is missing", () => {
    for (const key of Object.keys(complete) as (keyof typeof complete)[]) {
      expect(isEmployeeProfileIncomplete({ ...complete, [key]: null })).toBe(true);
    }
  });

  it("returns true for a record with nothing filled in (legacy pre-migration row)", () => {
    expect(
      isEmployeeProfileIncomplete({
        noKk: null,
        namaIbuKandung: null,
        educationLevelId: null,
        ptkpStatusCode: null,
        ktpFileId: null,
        kkFileId: null,
      })
    ).toBe(true);
  });
});

describe("missingFieldLabels", () => {
  it("lists only the missing fields, in a stable order", () => {
    expect(missingFieldLabels({ ...complete, ktpFileId: null, kkFileId: null })).toEqual([
      "File KTP",
      "File KK",
    ]);
  });

  it("returns an empty list when nothing is missing", () => {
    expect(missingFieldLabels(complete)).toEqual([]);
  });
});
