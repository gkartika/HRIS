"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "./actions";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, undefined);

  return (
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-medium text-slate-900">Atur ulang kata sandi</h1>
      <p className="mt-1 text-sm text-slate-500">
        Masukkan email Anda. Jika terdaftar, kami kirim tautan untuk membuat kata sandi baru.
      </p>
      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-xs text-slate-500">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        {state === "sent" && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Jika email itu terdaftar, tautan atur ulang sudah dikirim. Periksa kotak masuk Anda (dan folder spam).
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Mengirim..." : "Kirim tautan"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          ← Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}
