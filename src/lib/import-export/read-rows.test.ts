import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { fileToRows } from "./read-rows";

// An Excel date cell with the default short-date format (numFmt 14), the
// shape a hand-edited logbook has.
function xlsxFile(): File {
  const sheet = XLSX.utils.aoa_to_sheet(
    [
      ["Tanggal", "Nama Karyawan", "Jumlah"],
      [new Date(Date.UTC(2026, 6, 2, 12)), "Rindi", 4],
      ["02/07/2026", "Payumi", 1],
    ],
    { cellDates: true }
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Logbook");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new File([new Uint8Array(buffer)], "logbook.xlsx");
}

describe("fileToRows", () => {
  it("reads a real Excel date as yyyy-mm-dd when asked, never as a day/month swap", async () => {
    const rows = await fileToRows(xlsxFile(), { isoDates: true });
    expect(rows[0].Tanggal).toBe("2026-07-02");
    expect(rows[0].Jumlah).toBe("4");
  });

  it("leaves a text date untouched", async () => {
    const rows = await fileToRows(xlsxFile(), { isoDates: true });
    expect(rows[1].Tanggal).toBe("02/07/2026");
  });

  it("reads CSV as before", async () => {
    const rows = await fileToRows(new File(["Tanggal,Jumlah\n02/07/2026,3\n"], "x.csv"), { isoDates: true });
    expect(rows).toEqual([{ Tanggal: "02/07/2026", Jumlah: "3" }]);
  });
});
