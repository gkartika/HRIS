import * as XLSX from "xlsx";
import { parseCsvRows } from "./csv";

// Fingerprint machine exports and the old inventory sheets are commonly XLSX,
// unlike every other dataset in this app which is CSV-only — detected by
// extension and converted to the same plain row-object shape parseCsvRows
// already produces, so the rest of the dry-run/commit pipeline stays
// dataset-agnostic.
//
// `isoDates`: an Excel date cell saved with the default short-date format is
// rendered by SheetJS as US "m/d/yy" ("7/2/26" for 2 July 2026), which a
// day-first reader would take as 7 February. For datasets that read real date
// cells, ask for yyyy-mm-dd instead, which cannot be misread. Text cells and
// custom formats such as dd/mm/yyyy pass through unchanged.
export async function fileToRows(file: File, opts: { isoDates?: boolean } = {}): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    // The cell text is formatted while the workbook is read, so dateNF has to
    // be given here (not only to sheet_to_json) to replace the US format.
    const workbook = XLSX.read(buffer, { type: "buffer", ...(opts.isoDates ? { dateNF: "yyyy-mm-dd" } : {}) });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: "" });
  }
  const csvText = await file.text();
  return parseCsvRows(csvText);
}
