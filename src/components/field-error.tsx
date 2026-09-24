import type { FormState } from "@/lib/form-state";

const BASE_INVALID = "border-rose-400 ring-1 ring-rose-300";

// Red border for the field named in the server error.
export function invalidClass(state: FormState, name: string): string {
  return state?.field === name ? BASE_INVALID : "";
}

// Message directly under the field it belongs to.
export function FieldError({ state, name }: { state: FormState; name: string }) {
  if (state?.field !== name) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-rose-600">
      {state.error}
    </p>
  );
}

// Errors that don't belong to one field (permissions, overlaps…) stay at the bottom.
export function FormErrorSummary({ state }: { state: FormState }) {
  if (!state || state.field) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      {state.error}
    </p>
  );
}
