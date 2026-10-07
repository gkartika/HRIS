// Pure business logic for the Employee lifecycle display status (per direct
// user request, migration template 11_FIELD_MAP: "Active, OUT or Akan
// Masuk"). Deliberately NOT a stored field — Employee already has
// `activeFlag` and `hireDate`, and the 3-state value is fully derivable from
// those two, same "derive, don't duplicate" pattern already used for
// OnboardingOverallStatus/ExpiryUrgency/etc. `Employee.employmentStatus`
// remains a different concept entirely (contract type synced from the
// active Contract) — the migration sheet's "employment_status" column name
// collided with that existing field name but means this lifecycle concept
// instead; no schema change was made to reconcile the naming, only this
// derivation.
export type EmployeeLifecycleStatus = "AKAN_MASUK" | "ACTIVE" | "OUT";

export function deriveEmployeeLifecycleStatus(
  activeFlag: boolean,
  hireDate: Date | null,
  now: Date = new Date()
): EmployeeLifecycleStatus {
  if (!activeFlag) return "OUT";
  // No hire date recorded: nothing says they haven't started, so treat as active.
  return hireDate && hireDate > now ? "AKAN_MASUK" : "ACTIVE";
}
