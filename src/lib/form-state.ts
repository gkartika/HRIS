// Shared shape for forms that show errors next to the field that caused them
// and keep what the person typed. A server action returns this instead of a
// bare string; `values` echoes the submitted text fields back so the form can
// refill itself (React clears uncontrolled fields after every action).
export type FormState = { error: string; field?: string; values: Record<string, string> } | undefined;

export function formFail(formData: FormData, error: string, field?: string): FormState {
  const values: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string") values[k] = v;
  });
  return { error, field, values };
}
