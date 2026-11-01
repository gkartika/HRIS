// Pure rules for the Production Department forms (Tambahan jam kerja, Izin meninggalkan pekerjaan, Surat Peringatan): names,
// numbers, validation, the stepper and the plain-language status line. No Prisma/Next imports, so it is unit testable.
import { daysSince } from "@/lib/ga-home";
import type { DisciplineKind, ProductionFormKind, ProductionFormStatus } from "@/generated/prisma/enums";

export const FORM_PATH: Record<ProductionFormKind, string> = { EXTRA_WORK: "extra-work", LEAVE_WORK: "leave-work", DISCIPLINE: "discipline" };
export const FORM_LABEL: Record<ProductionFormKind, string> = { EXTRA_WORK: "Tambahan jam kerja", LEAVE_WORK: "Izin meninggalkan pekerjaan", DISCIPLINE: "Surat Peringatan" };
const FORM_PREFIX: Record<ProductionFormKind, string> = { EXTRA_WORK: "TJK", LEAVE_WORK: "IMP", DISCIPLINE: "SP" };

export function kindFromPath(path: string): ProductionFormKind | null {
  return (Object.keys(FORM_PATH) as ProductionFormKind[]).find((k) => FORM_PATH[k] === path) ?? null;
}

export function formatFormNumber(kind: ProductionFormKind, year: number, seq: number): string {
  return `${FORM_PREFIX[kind]}-${year}-${String(seq).padStart(4, "0")}`;
}

export const formHref = (kind: ProductionFormKind, id: string) => `/production-forms/${FORM_PATH[kind]}/${id}`;

// ---------- Surat Peringatan ----------

export const DISCIPLINE_LABEL: Record<DisciplineKind, string> = { WARNING: "Teguran", SP1: "SP 1", SP2: "SP 2", SP3: "SP 3" };
export const DISCIPLINE_ORDER: DisciplineKind[] = ["WARNING", "SP1", "SP2", "SP3"];
const DISCIPLINE_VALID_MONTHS = 6;

// Same day-of-month, `months` later, clamped to the end of a shorter month (31 Aug + 6 months = 28 Feb).
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

export function disciplineValidUntil(handedOverAt: Date): Date {
  return addMonthsUtc(handedOverAt, DISCIPLINE_VALID_MONTHS);
}

// The next step up from the highest warning still valid (none yet = Teguran), never above SP 3.
export function suggestedDisciplineKind(activeKinds: DisciplineKind[]): DisciplineKind {
  if (activeKinds.length === 0) return "WARNING";
  const top = Math.max(...activeKinds.map((k) => DISCIPLINE_ORDER.indexOf(k)));
  return DISCIPLINE_ORDER[Math.min(top + 1, DISCIPLINE_ORDER.length - 1)];
}

// ---------- time and amounts ----------

// "16.00", "16:00" or "8:5" -> minutes since midnight; null when it is not a time.
export function parseClock(input: string | null | undefined): number | null {
  const m = /^(\d{1,2})[.:](\d{1,2})$/.exec((input ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}

export function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}.${String(minutes % 60).padStart(2, "0")}`;
}

// Hours between a start and an end time; an end earlier than the start means the work ran past midnight.
export function hoursBetween(start: string, end: string): number | null {
  const a = parseClock(start);
  const b = parseClock(end);
  if (a === null || b === null) return null;
  const minutes = b > a ? b - a : b + 24 * 60 - a;
  return Math.round((minutes / 60) * 100) / 100;
}

// An amount typed as "1,5" or "1.5".
export function parseAmount(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const text = (input ?? "").toString().trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Number(text);
}

const MAX_WORKDAYS = 31;
const MAX_HOURS_PER_LINE = 24;

// Hours: at least 1 and fractions allowed (1.5). Workdays: more than 0 and at most 31.
export function extraWorkAmountProblem(unit: "HOURS" | "WORKDAYS", amount: number | null): string | null {
  if (amount === null) return "Isi jumlahnya dengan angka, misalnya 2 atau 1,5.";
  if (unit === "HOURS") {
    if (amount < 1) return "Minimal 1 jam.";
    if (amount > MAX_HOURS_PER_LINE) return `Paling banyak ${MAX_HOURS_PER_LINE} jam dalam satu formulir.`;
    return null;
  }
  if (amount <= 0) return "Jumlah hari kerja harus lebih dari 0.";
  if (amount > MAX_WORKDAYS) return `Paling banyak ${MAX_WORKDAYS} hari kerja.`;
  return null;
}

export function leaveTimesProblem(leave: string, back: string | null): string | null {
  const a = parseClock(leave);
  if (a === null) return "Isi jam keluar, misalnya 10.30.";
  if (back === null || back.trim() === "") return null;
  const b = parseClock(back);
  if (b === null) return "Jam kembali tidak valid. Kosongkan bila karyawan tidak kembali hari itu.";
  if (b <= a) return "Jam kembali harus sesudah jam keluar.";
  return null;
}

// "3,5 jam" / "2 hari kerja": how an amount reads on screen (Indonesian decimal comma).
export function formatAmount(amount: number, unit: "HOURS" | "WORKDAYS"): string {
  const text = String(Math.round(amount * 100) / 100).replace(".", ",");
  return unit === "HOURS" ? `${text} jam` : `${text} hari kerja`;
}

// ---------- status and stepper ----------

export const STEP_LABELS = ["Diajukan", "Atasan", "Admin SDM", "Selesai"];

// Index of the step that is waiting now (0..3); 4 = everything done.
export function currentStep(status: ProductionFormStatus): number {
  switch (status) {
    case "DRAFT":
    case "RETURNED":
      return 0;
    case "SUBMITTED":
      return 1;
    case "LEADER_APPROVED":
      return 2;
    case "COMPLETED":
      return 4;
    default:
      return -1; // rejected or cancelled: the stepper is not shown
  }
}

const EDITABLE_STATUSES: ProductionFormStatus[] = ["DRAFT", "RETURNED"];
const OPEN_STATUSES: ProductionFormStatus[] = ["SUBMITTED", "LEADER_APPROVED"];

export function canEdit(status: ProductionFormStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

// The Admin Produksi can still withdraw a form until the last step is done.
export function canCancel(status: ProductionFormStatus): boolean {
  return status === "DRAFT" || status === "RETURNED" || OPEN_STATUSES.includes(status);
}

export interface Approver {
  name: string;
  level: string;
}

export function approversText(approvers: Approver[]): string {
  if (approvers.length === 0) return "belum ada yang bisa menyetujui";
  return approvers.map((a) => `${a.name} (${a.level})`).join(" atau ");
}

export function waitText(since: Date | null, now: Date): string {
  if (!since) return "";
  const days = daysSince(since, now);
  return days === 0 ? "baru hari ini" : days === 1 ? "sejak kemarin" : `sejak ${days} hari`;
}

// What an Admin Produksi sees about where a form is, in plain words.
export function statusLine(
  kind: ProductionFormKind,
  form: { status: ProductionFormStatus; submittedAt: Date | null; leaderDecidedAt: Date | null; leaderDecidedByName: string | null },
  approvers: Approver[],
  now: Date
): string {
  switch (form.status) {
    case "DRAFT":
      return "Draf, belum diajukan";
    case "RETURNED":
      return "Dikembalikan, perlu diperbaiki";
    case "SUBMITTED":
      return `Menunggu ${approversText(approvers)} · ${waitText(form.submittedAt, now)}`;
    case "LEADER_APPROVED": {
      const by = form.leaderDecidedByName ? `Disetujui ${form.leaderDecidedByName}. ` : "Disetujui. ";
      const next = kind === "EXTRA_WORK" ? "Menunggu Admin SDM (persetujuan payroll)" : kind === "LEAVE_WORK" ? "Menunggu keputusan Admin SDM" : "Menunggu Admin SDM menyerahkan ke karyawan";
      return `${by}${next} · ${waitText(form.leaderDecidedAt, now)}`;
    }
    case "COMPLETED":
      return kind === "EXTRA_WORK" ? "Disetujui untuk payroll" : kind === "LEAVE_WORK" ? "Sudah diputuskan Admin SDM" : "Sudah diserahkan ke karyawan";
    case "REJECTED":
      return "Ditolak";
    case "CANCELLED":
      return "Dibatalkan";
  }
}

// The Admin SDM list line of a form waiting for them.
export function sdmActionLabel(kind: ProductionFormKind): string {
  return kind === "EXTRA_WORK" ? "Periksa" : kind === "LEAVE_WORK" ? "Putuskan" : "Catat penyerahan";
}

export function sdmWaitingText(kind: ProductionFormKind): string {
  return kind === "EXTRA_WORK" ? "Disetujui atasan, menunggu persetujuan payroll" : kind === "LEAVE_WORK" ? "Disetujui atasan, tentukan setengah atau penuh" : "Disetujui, belum diserahkan ke karyawan";
}

