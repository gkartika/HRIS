"use client";

import { useFormStatus } from "react-dom";

// The "Import" button of a batch. While the import runs it is disabled and a
// full-screen notice covers the page, so nothing else can be clicked (a second
// click used to start a second import of the same rows). The server also
// refuses a second run — this is the visible half of that lock.
export function CommitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Mengimpor… mohon tunggu" : label}
      </button>
      {pending && (
        <div role="alert" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <p className="text-sm font-semibold text-slate-900">Sedang mengimpor data</p>
            <p className="mt-2 text-sm text-slate-600">
              Jangan menutup atau memuat ulang halaman ini, dan jangan menekan tombol lagi. Halaman akan berpindah sendiri
              setelah selesai.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
