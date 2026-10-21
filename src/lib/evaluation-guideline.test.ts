import { describe, expect, it } from "vitest";
import { GUIDELINE_MAX_BYTES, safeFileName, validateGuidelineFile } from "./evaluation-guideline";

const pdfHead = new TextEncoder().encode("%PDF-1.7\n");

describe("validateGuidelineFile", () => {
  it("accepts a real PDF within the size limit", () => {
    expect(validateGuidelineFile({ name: "Pedoman 2026.pdf", size: 1_200_000, head: pdfHead })).toBeNull();
    expect(validateGuidelineFile({ name: "PEDOMAN.PDF", size: GUIDELINE_MAX_BYTES, head: pdfHead })).toBeNull();
  });

  it("refuses an empty file, a file over 4 MB, a different type, and a renamed non-PDF", () => {
    expect(validateGuidelineFile({ name: "a.pdf", size: 0, head: pdfHead })).toMatch(/kosong/);
    expect(validateGuidelineFile({ name: "a.pdf", size: GUIDELINE_MAX_BYTES + 1, head: pdfHead })).toMatch(/terlalu besar/);
    expect(validateGuidelineFile({ name: "a.docx", size: 1000, head: pdfHead })).toMatch(/PDF/);
    expect(validateGuidelineFile({ name: "foto.pdf", size: 1000, head: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]) })).toMatch(/bukan PDF/);
  });
});

describe("safeFileName", () => {
  it("keeps normal names and strips anything that could break a header", () => {
    expect(safeFileName("Pedoman Penilaian (2026).pdf")).toBe("Pedoman Penilaian (2026).pdf");
    expect(safeFileName('a"b\r\nc.pdf')).toBe("a_b_c.pdf");
    expect(safeFileName("   ")).toBe("pedoman.pdf");
  });
});
