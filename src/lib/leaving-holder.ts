// A person who is leaving: their exit case is still waiting for clearance (it always has a last working day). While they are
// still in the seat, the seat may take its next main holder (the replacement), so for a few days there are two main
// holders. Everything else keeps the one-holder-per-seat rule. Pure, so it can be tested.
export type OffboardingCaseLite = { status: string; lastWorkingDay: Date };

export function holderIsLeaving(cases: OffboardingCaseLite[]): boolean {
  return cases.some((c) => c.status === "PENDING_CLEARANCE");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "akan kosong: Reza Dwika Aulia keluar 29 Okt", shown next to a seat in a seat picker. */
export function leavingSeatLabel(name: string, lastWorkingDay: Date): string {
  return `akan kosong: ${name} keluar ${lastWorkingDay.getUTCDate()} ${MONTHS[lastWorkingDay.getUTCMonth()]}`;
}
