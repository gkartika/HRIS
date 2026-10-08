// Pure rules for the Posisi Organisasi import, kept free of the database so
// they can be unit-tested (see position-rules.test.ts).

// Typing this word in reportsToPositionCode removes a position's line
// manager. A blank cell means "leave unchanged" on an existing position, so a
// re-import of a partial file never wipes reporting lines by accident.
export const CLEAR_REPORTS_TO_KEYWORD = "KOSONGKAN";

export type ReportsToInstruction =
  | { kind: "UNCHANGED" }
  | { kind: "CLEAR" }
  | { kind: "SET"; positionCode: string };

export function parseReportsTo(value: string | undefined): ReportsToInstruction {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { kind: "UNCHANGED" };
  if (trimmed.toUpperCase() === CLEAR_REPORTS_TO_KEYWORD) return { kind: "CLEAR" };
  return { kind: "SET", positionCode: trimmed };
}

export function parseYesNo(value: string | undefined): boolean | null {
  const v = value?.trim().toUpperCase();
  if (!v) return null;
  if (v === "YA" || v === "TRUE") return true;
  if (v === "TIDAK" || v === "FALSE") return false;
  return null;
}

// Only one position in the company may carry HR Manager access. Given the
// rows that are otherwise valid and the positions that hold the flag today,
// returns a rejection reason per row index for every "Ya" row that would
// leave more than one holder after the import.
export function singleHrManagerViolations(
  rows: { index: number; positionCode: string; grantsHrManagerAccess: boolean | null }[],
  currentHolderCodes: string[]
): Map<number, string> {
  const violations = new Map<number, string>();
  const yesRows = rows.filter((r) => r.grantsHrManagerAccess === true);
  if (yesRows.length === 0) return violations;

  if (yesRows.length > 1) {
    const codes = yesRows.map((r) => r.positionCode).join(", ");
    for (const r of yesRows) {
      violations.set(r.index, `Akses HR Manager hanya boleh untuk satu posisi, tetapi berkas ini memberi "Ya" ke ${codes}`);
    }
    return violations;
  }

  const [yes] = yesRows;
  const removedInFile = new Set(rows.filter((r) => r.grantsHrManagerAccess === false).map((r) => r.positionCode));
  const remainingHolders = currentHolderCodes.filter((code) => code !== yes.positionCode && !removedInFile.has(code));
  if (remainingHolders.length > 0) {
    violations.set(
      yes.index,
      `Akses HR Manager sudah dimiliki posisi ${remainingHolders.join(", ")}. Isi "Tidak" untuk posisi tersebut di berkas yang sama, atau hapus centangnya di halaman posisi terlebih dahulu`
    );
  }
  return violations;
}
