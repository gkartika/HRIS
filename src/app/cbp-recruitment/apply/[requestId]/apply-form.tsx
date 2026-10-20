"use client";

import { startTransition, useActionState } from "react";
import { applyExternalAction } from "../../actions";
import { DocumentFileInput } from "@/components/document-file-input";

const inputClass = "w-full rounded-lg border border-[#cfc4d6] bg-white px-3 py-2.5 text-[15px] text-[#231a28] focus:border-brand focus:outline-none";
const labelClass = "mb-1 block text-[13px] font-semibold text-[#4a3e52]";

export function ApplyForm({ requestId }: { requestId: string }) {
  const action = applyExternalAction.bind(null, requestId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    // onSubmit instead of action=: React 19 empties an action form after it runs, which would
    // wipe everything the applicant typed (and the CV) after a wrong access code.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-4 rounded-xl border border-[#e6dcea] bg-white p-5"
    >
      <div>
        <label htmlFor="accessCode" className={labelClass}>
          Kode akses lowongan
        </label>
        <input id="accessCode" name="accessCode" required autoComplete="off" placeholder="CBP-XXXX-XXXX" className={`${inputClass} font-mono uppercase`} />
        <p className="mt-1 text-xs text-[#8a7e92]">Tertulis di iklan lowongan.</p>
      </div>
      <div>
        <label htmlFor="fullName" className={labelClass}>
          Nama lengkap
        </label>
        <input id="fullName" name="fullName" required autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="mobileNumber" className={labelClass}>
          Nomor WhatsApp
        </label>
        <input id="mobileNumber" name="mobileNumber" type="tel" required autoComplete="tel" placeholder="0812 3456 7890" className={inputClass} />
      </div>
      <div>
        <label htmlFor="cv" className={labelClass}>
          CV (opsional)
        </label>
        <DocumentFileInput id="cv" name="cv" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="block w-full text-sm text-[#4a3e52]" />
        <p className="mt-1 text-xs text-[#8a7e92]">PDF, Word, atau foto. Maksimal 4 MB.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-[10px] border border-[#f3c1c6] bg-[#fdecee] px-3 py-2.5 text-[13.5px] text-[#a1252f]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-brand px-4 py-3 text-[15px] font-bold text-white hover:bg-brand-dark disabled:cursor-progress disabled:opacity-60"
      >
        {isPending ? "Mengirim..." : "Kirim lamaran dan mulai tes"}
      </button>
      <p className="text-xs text-[#8a7e92]">
        Data Anda hanya dipakai untuk proses seleksi di PT Cahaya Bukit Perunggu dan dihapus setelah masa penyimpanan jika Anda tidak diterima.
      </p>
    </form>
  );
}
