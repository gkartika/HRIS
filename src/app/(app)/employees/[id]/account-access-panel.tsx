"use client";

import { useActionState } from "react";
import { sendAccountLink } from "./account-actions";

const STATUS: Record<string, { label: string; tone: string }> = {
  NONE: { label: "Belum ada akun", tone: "bg-slate-100 text-slate-600" },
  INVITED: { label: "Undangan terkirim", tone: "bg-amber-50 text-amber-700" },
  ACTIVE: { label: "Aktif", tone: "bg-emerald-50 text-emerald-700" },
  LOCKED: { label: "Terkunci", tone: "bg-amber-50 text-amber-700" },
  DISABLED: { label: "Ditahan", tone: "bg-rose-50 text-rose-700" },
};

// Admin SDM's one control for an employee's login: send the invitation, send it
// again, or send a password-reset link. The employee sets their own password.
export function AccountAccessPanel({
  employeeId,
  accountStatus,
  personalEmail,
}: {
  employeeId: string;
  accountStatus: string | null;
  personalEmail: string | null;
}) {
  const [result, formAction, isPending] = useActionState(sendAccountLink.bind(null, employeeId), undefined);
  const status = STATUS[accountStatus ?? "NONE"] ?? STATUS.NONE;

  const buttonLabel =
    accountStatus === null ? "Kirim undangan" : accountStatus === "INVITED" ? "Kirim ulang undangan" : "Kirim tautan atur ulang kata sandi";
  const hint =
    accountStatus === null
      ? "Membuat akun dan mengirim tautan untuk membuat kata sandi ke email di bawah."
      : accountStatus === "LOCKED"
        ? "Akun terkunci karena salah kata sandi berulang. Mengatur ulang kata sandi akan membukanya."
        : accountStatus === "ACTIVE"
          ? "Karyawan menerima tautan untuk membuat kata sandi baru."
          : "";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-slate-900">Akun Masuk</h2>
          <p className="mt-1 text-xs text-slate-500">
            Email masuk: {personalEmail ?? <span className="text-rose-600">belum diisi — isi Email Pribadi lewat Ubah Data</span>}
          </p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${status.tone}`}>{status.label}</span>
      </div>

      {accountStatus !== "DISABLED" && (
        <form action={formAction} className="mt-4 space-y-2">
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
          <button
            type="submit"
            disabled={isPending || !personalEmail}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "Mengirim..." : buttonLabel}
          </button>
          {result && (
            <p role="status" className={`text-xs ${result.ok ? "text-emerald-700" : "text-rose-600"}`}>
              {result.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
