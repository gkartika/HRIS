import type { PositionType, PositionStatus } from "@/generated/prisma/enums";

// Single source of truth for the PositionType enum's display order in
// admin forms — was hand-duplicated across positions/create-form.tsx,
// positions/[id]/edit-form.tsx, and jobs/[id]/edit-form.tsx.
export const POSITION_TYPES: PositionType[] = ["STAFF", "TEAM_LEAD", "SECTION_HEAD", "DEPARTMENT_HEAD", "DIRECTOR"];

// The only Position statuses in use (decided 2026-10-08): a seat is Kosong or
// Terisi, always derived from its placements. A seat that is no longer needed
// is archived directly. PLANNED/FROZEN/CLOSED stay in the database enum only
// because enum values are never dropped from the shared production database.
export const POSITION_STATUSES: PositionStatus[] = ["VACANT", "FILLED"];
