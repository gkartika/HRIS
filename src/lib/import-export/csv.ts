import Papa from "papaparse";

export function parseCsvRows(csvText: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data;
}

export function rowsToCsv(headers: string[], rows: Record<string, string>[]): string {
  return Papa.unparse({ fields: headers, data: rows.map((r) => headers.map((h) => r[h] ?? "")) });
}

export function templateCsv(headers: string[], exampleRow: Record<string, string>): string {
  return Papa.unparse({ fields: headers, data: [headers.map((h) => exampleRow[h] ?? "")] });
}
