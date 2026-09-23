// "Masuk (Lupa Absen)" — a distinct sentinel in the absenceTypeCode select
// rather than a real AbsenceTypeConfig row, since it isn't an absence at
// all: per direct request, a day with no punch is often just a forgotten
// scan, so HR marks it present directly instead of picking a category.
// Shared by the server action and both classify forms (a plain constant
// can't live in actions.ts — a "use server" file may only export async
// functions).
export const PRESENT_OVERRIDE_SENTINEL = "__PRESENT__";
