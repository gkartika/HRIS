import type { PositionType } from "@/generated/prisma/enums";

// Single source of truth for the PositionType enum's display order in
// admin forms — was hand-duplicated across positions/create-form.tsx,
// positions/[id]/edit-form.tsx, and jobs/[id]/edit-form.tsx.
export const POSITION_TYPES: PositionType[] = ["STAFF", "TEAM_LEAD", "SECTION_HEAD", "DEPARTMENT_HEAD", "DIRECTOR"];
