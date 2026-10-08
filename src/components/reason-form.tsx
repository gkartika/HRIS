"use client";

import { useActionState, useState } from "react";
import { t } from "@/lib/i18n/id";

type ReasonAction = (previousState: string | undefined, formData: FormData) => Promise<string | undefined>;

// One "cancel this, with a written reason" control: a button that opens a small
// form with a reason box, a confirm button and a way back. Used by the cancel
// flows of absences, perubahan posisi, recruitment, GA requests, offboarding and
// training requests. `action` is the server action already bound to the record.
// The three variants only differ in how the opened form is dressed, so each page
// keeps the look it had.
type Variant = "rose" | "slate" | "card";

const LOOK: Record<
  Variant,
  { trigger: string; form: string; label: string; wrapField: boolean; submit: string; back: string; errorAbove: boolean; showRequiredNote: boolean }
> = {
  rose: {
    trigger: "rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100",
    form: "w-full space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3",
    label: "block text-xs text-slate-600",
    wrapField: false,
    submit: "rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60",
    back: "rounded-lg px-4 py-2 text-sm text-slate-500",
    errorAbove: false,
    showRequiredNote: true,
  },
  slate: {
    trigger: "rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100",
    form: "w-full space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4",
    label: "mb-1 block text-xs text-slate-500",
    wrapField: true,
    submit: "rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60",
    back: "rounded-lg px-4 py-2 text-sm text-slate-500",
    errorAbove: false,
    showRequiredNote: false,
  },
  card: {
    trigger: "text-xs text-rose-600 hover:underline",
    form: "space-y-3 rounded-xl border border-slate-200 bg-white p-4",
    label: "mb-1 block text-xs text-slate-500",
    wrapField: true,
    submit: "rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60",
    back: "rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700",
    errorAbove: true,
    showRequiredNote: false,
  },
};

const TEXTAREA = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

export function ReasonForm({
  action,
  triggerLabel,
  reasonLabel,
  submitLabel,
  pendingLabel,
  fieldName = "cancellationReason",
  required = false,
  variant = "rose",
}: {
  action: ReasonAction;
  triggerLabel: string;
  reasonLabel: string;
  submitLabel?: string;
  pendingLabel?: string;
  fieldName?: string;
  required?: boolean;
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const look = LOOK[variant];

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={look.trigger}>
        {triggerLabel}
      </button>
    );
  }

  const field = <textarea name={fieldName} required={required} rows={2} className={TEXTAREA} />;
  const errorLine = error ? (
    look.errorAbove ? (
      <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
    ) : (
      <p className="text-xs text-rose-600">{error}</p>
    )
  ) : null;

  return (
    <form action={formAction} className={look.form}>
      {look.errorAbove && errorLine}
      {look.wrapField ? (
        <div>
          <label className={look.label}>{reasonLabel}</label>
          {field}
        </div>
      ) : (
        <>
          <label className={look.label}>
            {reasonLabel}
            {look.showRequiredNote ? " (wajib)" : ""}
          </label>
          {field}
        </>
      )}
      {!look.errorAbove && errorLine}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={look.submit}>
          {isPending ? (pendingLabel ?? t("common.loading")) : (submitLabel ?? triggerLabel)}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={look.back}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
