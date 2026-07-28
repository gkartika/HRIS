// Shared types for the CTL-13 universal import/export framework. Every
// dataset module (org-units.ts, jobs.ts, positions.ts, assignments.ts,
// employees.ts) implements this same shape so the generic hub page,
// preview/commit page, and template/export routes can treat all datasets
// uniformly.

export interface DryRunRow {
  rowNumber: number;
  raw: Record<string, string>;
  isValid: boolean;
  rejectionReason: string | null;
  // null when the row is invalid — there's nothing to do with it yet.
  action: "CREATE" | "UPDATE" | null;
  existingId?: string;
}

export interface ExportResult {
  headers: string[];
  rows: Record<string, string>[];
}

export interface CommitResult {
  id: string;
  action: "CREATE" | "UPDATE";
}
