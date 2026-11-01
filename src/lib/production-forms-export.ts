// The two extra sheets of the monthly payroll Excel (the Rekonsiliasi export): approved Tambahan jam kerja and the
// decisions on Izin meninggalkan pekerjaan of the payroll period. Pure row building (no Prisma), so it is unit tested.
import type { ExtraWorkUnit, LeaveWorkDecision } from "@/generated/prisma/enums";

export interface ExtraWorkExportLine {
  requestNumber: string;
  workDate: Date;
  employeeNumber: string;
  employeeName: string;
  unit: ExtraWorkUnit;
  requested: number;
  /** Admin SDM's final amount; empty = same as requested. */
  final: number | null;
  startTime: string | null;
  endTime: string | null;
  reason: string;
  approvedBy: string | null;
  note: string | null;
}

export interface LeaveWorkExportRow {
  requestNumber: string;
  workDate: Date;
  employeeNumber: string;
  employeeName: string;
  leaveTime: string;
  returnTime: string | null;
  decision: LeaveWorkDecision;
  reason: string;
  approvedBy: string | null;
  note: string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export const EXTRA_WORK_SHEET_NAME = "Tambahan jam kerja";
export const LEAVE_WORK_SHEET_NAME = "Izin meninggalkan pekerjaan";

// Amounts are plain numbers so payroll can sum them in Excel; "Jumlah dibayar" is the final amount (or the requested one).
export function buildExtraWorkSheet(lines: ExtraWorkExportLine[]): (string | number)[][] {
  const header = ["No formulir", "Tanggal", "NIP", "Nama", "Satuan", "Jumlah diajukan", "Jumlah dibayar", "Mulai", "Selesai", "Alasan", "Disetujui atasan", "Catatan Admin SDM"];
  const body = lines.map((l) => [
    l.requestNumber,
    iso(l.workDate),
    l.employeeNumber,
    l.employeeName,
    l.unit === "HOURS" ? "Jam" : "Hari kerja",
    l.requested,
    l.final ?? l.requested,
    l.startTime ?? "",
    l.endTime ?? "",
    l.reason,
    l.approvedBy ?? "",
    l.note ?? "",
  ]);
  return [header, ...body];
}

export function buildLeaveWorkSheet(rows: LeaveWorkExportRow[]): (string | number)[][] {
  const header = ["No formulir", "Tanggal", "NIP", "Nama", "Jam keluar", "Jam kembali", "Keputusan", "Kode absensi", "Alasan", "Disetujui atasan", "Catatan Admin SDM"];
  const body = rows.map((r) => [
    r.requestNumber,
    iso(r.workDate),
    r.employeeNumber,
    r.employeeName,
    r.leaveTime,
    r.returnTime ?? "tidak kembali",
    r.decision === "HALF_DAY" ? "Setengah hari" : "Satu hari penuh",
    r.decision === "HALF_DAY" ? "SH" : "I",
    r.reason,
    r.approvedBy ?? "",
    r.note ?? "",
  ]);
  return [header, ...body];
}
