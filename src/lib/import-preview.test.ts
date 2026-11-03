import { describe, expect, it } from "vitest";
import { isSkippedRow, sortPreviewRows } from "./import-preview";

const row = (rowNumber: number, isValid: boolean, rejectionReason: string | null = null) => ({ rowNumber, isValid, rejectionReason });

describe("import preview", () => {
  it("treats repeats as skipped and real problems as rejected", () => {
    expect(isSkippedRow(row(1, false, "Pemindaian ganda (2x pada hari ini) — sudah terwakili oleh baris pukul 07.20"))).toBe(true);
    expect(isSkippedRow(row(1, false, "Sudah pernah diimpor sebelumnya (waktu dan jenis absensi sama)"))).toBe(true);
    expect(isSkippedRow(row(1, false, "Baris ini duplikat dari baris lain pada berkas yang sama"))).toBe(true);
    expect(isSkippedRow(row(1, false, 'Nama "X" pada mesin tidak cocok dengan nama karyawan aktif manapun di SAPA'))).toBe(false);
    expect(isSkippedRow(row(1, true))).toBe(false);
  });

  it("puts the rows to fix first, then skipped, then valid, each in row order", () => {
    const sorted = sortPreviewRows([row(2, true), row(3, false, "Pemindaian ganda"), row(4, false, "Nama tidak cocok"), row(5, true), row(6, false, "Nama tidak cocok")]);
    expect(sorted.map((r) => r.rowNumber)).toEqual([4, 6, 3, 2, 5]);
  });
});
