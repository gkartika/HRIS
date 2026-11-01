// Rows of the monthly BPJS TK list Excel (pure, unit tested). NIK is text so Excel does not turn it into 3.2E+15.
export interface BpjsExportRow {
  name: string;
  status: string;
  section: string;
  nik: string | null;
  birthDate: Date | null;
  bpjsTkNumber: string | null;
}

export function buildBpjsListSheet(rows: BpjsExportRow[]): (string | number)[][] {
  const header = ["No", "Nama", "Status", "Bagian", "NIK", "Tanggal lahir", "No. BPJS TK"];
  const body = rows.map((r, i) => [i + 1, r.name, r.status, r.section, r.nik ?? "", r.birthDate ? r.birthDate.toISOString().slice(0, 10) : "", r.bpjsTkNumber ?? ""]);
  return [header, ...body];
}
