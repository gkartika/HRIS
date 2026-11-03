// Shared by every import that matches people by display name rather than ID
// (fingerprint raw export, consumables logbook): trim, collapse inner
// whitespace, lowercase.
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

// Machine name -> employee id. Every employee is found by the full name in SAPA; an optional "name on the machine"
// (the alias, for people the machine spells differently) finds the same employee too. A name that points to two
// different employees maps to null, so it is rejected instead of guessed.
export function buildEmployeeNameIndex(
  employees: { id: string; fullLegalName: string }[],
  aliases: { employeeId: string; alias: string }[]
): Map<string, string | null> {
  const index = new Map<string, string | null>();
  const add = (name: string, employeeId: string) => {
    const key = normalizeName(name);
    if (!key) return;
    const current = index.get(key);
    index.set(key, current === undefined || current === employeeId ? employeeId : null);
  };
  for (const e of employees) add(e.fullLegalName, e.id);
  for (const a of aliases) add(a.alias, a.employeeId);
  return index;
}
