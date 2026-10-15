// Rules for what an employee must write when sending a GA request from Perlengkapan Saya.
// Pure logic, no Prisma imports, so it is unit testable.
import type { GaRequestStatus, GaRequestType } from "@/generated/prisma/enums";

export const MIN_NEED_CHARS = 10;
export const MIN_REPORT_CHARS = 20;

// A new-asset need only needs a short description. A damage or loss report has to say what
// happened, so it must be longer: the person writes the damage, or the chronology of the loss.
export function validateRequestText(type: GaRequestType, description: string): string | null {
  const text = description.trim();
  if (type === "NEW_ASSET_NEED") {
    return text.length >= MIN_NEED_CHARS ? null : `Tuliskan kebutuhan Anda dengan jelas (minimal ${MIN_NEED_CHARS} karakter).`;
  }
  if (text.length >= MIN_REPORT_CHARS) return null;
  return type === "LOSS"
    ? `Tuliskan kronologi kehilangan: kapan, di mana, bagaimana (minimal ${MIN_REPORT_CHARS} karakter).`
    : `Jelaskan apa yang rusak dan bagaimana kejadiannya (minimal ${MIN_REPORT_CHARS} karakter).`;
}

// While a report is in one of these statuses the asset already has an open report, so it is not
// reported a second time. A finished or turned-down report frees the asset again.
export const OPEN_REPORT_STATUSES: Record<"DAMAGE_OR_ABNORMAL_CONDITION" | "LOSS", GaRequestStatus[]> = {
  DAMAGE_OR_ABNORMAL_CONDITION: ["SUBMITTED", "WORK_ORDER_CREATED"],
  LOSS: ["SUBMITTED", "PENDING_LOSS_REVIEW"],
};

export function isOpenReport(type: GaRequestType, status: GaRequestStatus): boolean {
  if (type === "NEW_ASSET_NEED") return false;
  return OPEN_REPORT_STATUSES[type].includes(status);
}

// "2026-10-14" -> "14/10/2026", for the line added to a loss description.
export function formatLossDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
