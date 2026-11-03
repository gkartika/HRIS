// The import preview: which rejected rows are only repeats and which really need fixing. Pure, so it is unit tested.

interface PreviewRow {
  isValid: boolean;
  rejectionReason: string | null;
}

// A repeat (a second scan of the same person that day, a punch imported before, a duplicate line in the file) is skipped,
// not an error to fix.
export function isSkippedRow(row: PreviewRow): boolean {
  return !row.isValid && /^(Pemindaian ganda|Sudah pernah diimpor|Baris ini duplikat)/.test(row.rejectionReason ?? "");
}

// Rows to fix first, then skipped ones, then valid ones; row order inside each group.
export function previewRank(row: PreviewRow): number {
  return row.isValid ? 2 : isSkippedRow(row) ? 1 : 0;
}

export function sortPreviewRows<T extends PreviewRow & { rowNumber: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => previewRank(a) - previewRank(b) || a.rowNumber - b.rowNumber);
}
