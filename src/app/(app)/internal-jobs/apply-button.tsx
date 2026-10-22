"use client";

import { startTransition, useActionState, useState } from "react";
import { applyInternalAction } from "./actions";
import { ApplicantContactFields } from "@/components/applicant-contact-fields";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";
const hintClass = "mt-1 text-xs text-slate-500";

// "Lamar posisi ini" opens a short form: email and WhatsApp (prefilled from the employee profile, kept for this
// application only), the newest CV and one optional supporting document.
export function ApplyInternalButton({ requestId, defaultEmail, defaultMobile }: { requestId: string; defaultEmail: string; defaultMobile: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, pending] = useActionState(applyInternalAction.bind(null, requestId), undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        Lamar posisi ini
      </button>
    );
  }

  return (
    // onSubmit instead of action=: React 19 empties an action form after it runs, which would wipe what the
    // employee typed (and the chosen files) after an error.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="max-w-xl space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
        Data di bawah dipakai tim rekrutmen untuk menghubungi Anda dan hanya berlaku untuk lamaran ini. Profil karyawan Anda tidak berubah. Setelah melamar Anda langsung
        mengerjakan tes online. Atasan Anda tidak diberi tahu sampai posisi baru resmi Anda dapatkan.
      </p>
      <ApplicantContactFields
        defaultEmail={defaultEmail}
        defaultMobile={defaultMobile}
        inputClass={inputClass}
        labelClass={labelClass}
        hintClass={hintClass}
        prefilledNote="Terisi dari profil. Bisa diganti."
      />
      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Mengirim..." : "Lamar dan mulai tes"}
        </button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </form>
  );
}
