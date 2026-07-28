import { describe, it, expect } from "vitest";
import {
  validateNoKk,
  validateDocumentFile,
  MAX_DOCUMENT_SIZE_BYTES,
} from "./employee-fields";

describe("validateNoKk", () => {
  it("accepts exactly 16 digits", () => {
    expect(validateNoKk("3374010101880001")).toBeNull();
  });

  it("preserves and accepts leading zeroes", () => {
    expect(validateNoKk("0000000000000001")).toBeNull();
  });

  it("treats empty as optional (no error)", () => {
    expect(validateNoKk("")).toBeNull();
    expect(validateNoKk("   ")).toBeNull();
  });

  it("rejects fewer than 16 digits", () => {
    expect(validateNoKk("123456789012345")).toContain("16 digit");
  });

  it("rejects more than 16 digits", () => {
    expect(validateNoKk("12345678901234567")).toContain("16 digit");
  });

  it("rejects non-numeric characters", () => {
    expect(validateNoKk("337401010188000A")).toContain("16 digit");
    expect(validateNoKk("3374-0101-0188-01")).toContain("16 digit");
  });
});

describe("validateDocumentFile", () => {
  const validPdf = { name: "ktp.pdf", type: "application/pdf", size: 1024 };
  const validJpg = { name: "ktp.jpg", type: "image/jpeg", size: 1024 };
  const validPng = { name: "kk.png", type: "image/png", size: 1024 };

  it("accepts PDF, JPG, and PNG under the size limit", () => {
    expect(validateDocumentFile(validPdf)).toBeNull();
    expect(validateDocumentFile(validJpg)).toBeNull();
    expect(validateDocumentFile(validPng)).toBeNull();
  });

  it("rejects an unsupported MIME type", () => {
    const error = validateDocumentFile({ name: "ktp.gif", type: "image/gif", size: 1024 });
    expect(error).toContain("PDF, JPG, JPEG, atau PNG");
  });

  it("rejects a mismatched extension even if the MIME type is on the allow-list", () => {
    // A renamed file reporting an allowed MIME type but a disallowed extension
    // must still be rejected — CTL-12 requires checking both independently.
    const error = validateDocumentFile({ name: "payload.exe", type: "image/png", size: 1024 });
    expect(error).toContain("PDF, JPG, JPEG, atau PNG");
  });

  it("rejects a file over 10 MB", () => {
    const error = validateDocumentFile({
      name: "big.pdf",
      type: "application/pdf",
      size: MAX_DOCUMENT_SIZE_BYTES + 1,
    });
    expect(error).toContain("10 MB");
  });

  it("accepts a file exactly at the 10 MB limit", () => {
    expect(
      validateDocumentFile({ name: "exact.pdf", type: "application/pdf", size: MAX_DOCUMENT_SIZE_BYTES })
    ).toBeNull();
  });

  it("rejects an empty file", () => {
    const error = validateDocumentFile({ name: "empty.pdf", type: "application/pdf", size: 0 });
    expect(error).not.toBeNull();
  });
});
