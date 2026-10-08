"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "./actions";
import { authButtonClass, authInputClass, authLabelClass, authLinkClass } from "@/components/auth-shell";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, undefined);

  return (
    <div>
      <h1 className="mt-6 text-3xl font-extrabold text-[#231a28]">Atur ulang kata sandi</h1>
      <p className="mt-1.5 text-[14.5px] text-[#6a5f72]">
        Masukkan email Anda. Jika terdaftar, kami kirim tautan untuk membuat kata sandi baru.
      </p>
      <form action={formAction} className="mt-5 space-y-4">
        <div>
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="nama@ptcbp.com"
            className={authInputClass}
          />
        </div>
        {state === "sent" && (
          <p role="status" className="rounded-[10px] border border-[#bfe0cd] bg-[#e6f4ec] px-3 py-2.5 text-[13.5px] text-[#1d6b43]">
            Jika email itu terdaftar, tautan atur ulang sudah dikirim. Periksa kotak masuk Anda (dan folder spam).
          </p>
        )}
        <button type="submit" disabled={isPending} className={`${authButtonClass} mt-2`}>
          {isPending ? "Mengirim..." : "Kirim tautan"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className={authLinkClass}>
          ← Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}
