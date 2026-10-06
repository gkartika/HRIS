// Shared by every import that matches people by display name rather than ID
// (fingerprint raw export, consumables logbook): trim, collapse inner
// whitespace, lowercase.
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
