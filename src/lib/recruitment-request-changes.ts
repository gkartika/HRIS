import { nextStatusAfterFulfillment } from "@/lib/recruitment";
import type { RecruitmentRequestEventKind, RecruitmentRequestStatus, RequestedJobLevel } from "@/generated/prisma/enums";

// What can still be done to a recruitment request after it was filed: hold it, reduce the number,
// set or change its Jabatan. Pure rules, the actions in recruitment/actions.ts apply them.

// A request can be held once approved, until it is filled, closed or cancelled.
export const HOLDABLE_STATUSES: RecruitmentRequestStatus[] = ["APPROVED", "RECRUITMENT_IN_PROGRESS", "PARTIALLY_FILLED"];

export function canHoldStatus(status: RecruitmentRequestStatus): boolean {
  return HOLDABLE_STATUSES.includes(status);
}

export function isHeld(request: { heldAt: Date | null }): boolean {
  return request.heldAt !== null;
}

export const HELD_MESSAGE = "Permintaan ini sedang ditahan. Lanjutkan dulu permintaannya.";

// The Jabatan can be set from the Department Head stage onwards, and changed until the request is filled.
const JOB_SETTABLE_STATUSES: RecruitmentRequestStatus[] = ["PENDING_DEPT_HEAD", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "RECRUITMENT_IN_PROGRESS", "PARTIALLY_FILLED"];

export function canSetJobStatus(status: RecruitmentRequestStatus): boolean {
  return JOB_SETTABLE_STATUSES.includes(status);
}

// After approval a change needs a written reason; before it, setting or correcting is free.
export function jobChangeNeedsReason(status: RecruitmentRequestStatus): boolean {
  return canHoldStatus(status);
}

// Changing the Jabatan of a request that already placed someone, or has a Mutasi running, would leave those
// tied to a seat of the old Jabatan.
export function jobChangeProblem(input: { filled: number; mutationsUnderway: number; internalMovesUnderway: number }): string | null {
  if (input.filled > 0) return "Jabatan tidak bisa diubah: sudah ada karyawan yang ditempatkan lewat permintaan ini.";
  if (input.mutationsUnderway > 0 || input.internalMovesUnderway > 0) {
    return "Jabatan tidak bisa diubah: masih ada Mutasi yang berjalan. Selesaikan atau batalkan Mutasinya dulu.";
  }
  return null;
}

// The lowest number a request can be reduced to: the people already placed plus the Mutasi still running.
export function headcountFloor(filled: number, mutationsUnderway: number): number {
  return Math.max(1, filled + mutationsUnderway);
}

export function reduceHeadcountProblem(input: { status: RecruitmentRequestStatus; current: number; next: number; filled: number; mutationsUnderway: number }): string | null {
  if (!canHoldStatus(input.status)) return "Jumlah hanya bisa dikurangi setelah permintaan disetujui dan sebelum terisi penuh.";
  if (!Number.isInteger(input.next)) return "Isi jumlah baru dengan angka bulat.";
  if (input.next > input.current) return "Jumlah tidak bisa ditambah di sini. Buat permintaan baru supaya disetujui lagi.";
  if (input.next === input.current) return "Jumlah baru sama dengan jumlah sekarang.";
  const floor = headcountFloor(input.filled, input.mutationsUnderway);
  if (input.next < floor) {
    return input.mutationsUnderway > 0
      ? `Tidak bisa kurang dari ${floor}: ${input.filled} karyawan sudah ditempatkan dan ${input.mutationsUnderway} Mutasi masih berjalan.`
      : `Tidak bisa kurang dari ${floor}: ${input.filled} karyawan sudah ditempatkan.`;
  }
  return null;
}

// Reducing to what is already placed makes the request Terisi; otherwise its status stays as it was.
export function statusAfterReduce(status: RecruitmentRequestStatus, next: number, filled: number): RecruitmentRequestStatus {
  return filled > 0 && filled >= next ? nextStatusAfterFulfillment(next, filled) : status;
}

// A new seat copies the level and type of a seat that already exists for the same Jabatan; with none,
// the requested level decides.
const FALLBACK_SEAT: Record<RequestedJobLevel, { jobLevel: string; positionType: "STAFF" | "TEAM_LEAD" | "SECTION_HEAD" | "DEPARTMENT_HEAD" }> = {
  DEPARTMENT_HEAD: { jobLevel: "3B", positionType: "DEPARTMENT_HEAD" },
  SECTION_HEAD: { jobLevel: "2C", positionType: "SECTION_HEAD" },
  SUPERVISOR: { jobLevel: "2A", positionType: "TEAM_LEAD" },
  STAFF_OPERATOR: { jobLevel: "1C", positionType: "STAFF" },
  HARIAN_LEPAS: { jobLevel: "1A", positionType: "STAFF" },
};

export function fallbackSeatSpec(level: RequestedJobLevel | null) {
  return FALLBACK_SEAT[level ?? "STAFF_OPERATOR"];
}

// "JOB-053" -> "JOB-054": the next free code with the same prefix and width.
export function nextCode(prefix: string, existing: string[], width = 3): string {
  let max = 0;
  for (const code of existing) {
    if (!code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

// One line of the request's "Riwayat".
export function describeEvent(e: { kind: RecruitmentRequestEventKind; fromValue: string | null; toValue: string | null; note: string | null }): string {
  const tail = e.note ? `: "${e.note}"` : "";
  switch (e.kind) {
    case "HELD":
      return `menahan permintaan${tail}`;
    case "RESUMED":
      return "melanjutkan permintaan";
    case "HEADCOUNT_REDUCED":
      return `mengurangi jumlah ${e.fromValue} menjadi ${e.toValue}${tail}`;
    case "JOB_SET":
      return `menetapkan jabatan ${e.toValue}`;
    case "JOB_CHANGED":
      return `mengubah jabatan ${e.fromValue} menjadi ${e.toValue}${tail}`;
  }
}
