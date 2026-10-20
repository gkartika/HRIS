"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import {
  addRecruitmentAdminAction,
  holdRecruitmentAdminAction,
  reactivateRecruitmentAdminAction,
  sendRecruitmentAdminLinkAction,
  type LinkResult,
} from "./actions";

export function AddRecruitmentAdminForm() {
  const router = useRouter();
  const [error, formAction, pending] = useActionState(addRecruitmentAdminAction, undefined);
  const [done, setDone] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setDone(false);
        startTransition(async () => {
          await formAction(data);
          setDone(true);
          router.refresh();
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-[260px] flex-1">
        <label htmlFor="ra-email" className="mb-1 block text-xs text-slate-500">
          Email untuk login Admin Rekrutmen
        </label>
        <input id="ra-email" name="email" type="email" required placeholder="rekrutmen@ptcbp.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Mengirim..." : "Buat akun dan kirim undangan"}
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
      {done && !error && !pending && <p className="w-full text-xs text-emerald-700">Akun dibuat dan undangan dikirim ke email itu.</p>}
    </form>
  );
}

export function AccountRowControls({ accountId, status }: { accountId: string; status: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [result, setResult] = useState<LinkResult | null>(null);

  const linkLabel = status === "INVITED" ? "Kirim ulang undangan" : "Kirim tautan atur ulang kata sandi";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status !== "DISABLED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              setResult(await sendRecruitmentAdminLinkAction(accountId));
              router.refresh();
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {linkLabel}
        </button>
      )}
      {status === "DISABLED" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const message = await reactivateRecruitmentAdminAction(accountId);
              setResult(message ? { ok: false, message } : { ok: true, message: "Akun diaktifkan kembali." });
              router.refresh();
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Aktifkan kembali
        </button>
      ) : (
        <ConfirmButton
          label="Tahan akun"
          confirmLabel="Ya, tahan akun"
          pending={pending}
          onConfirm={() =>
            run(async () => {
              const message = await holdRecruitmentAdminAction(accountId);
              setResult(message ? { ok: false, message } : { ok: true, message: "Akun ditahan. Orang ini tidak bisa masuk." });
              router.refresh();
            })
          }
        />
      )}
      {result && <span className={`text-xs ${result.ok ? "text-emerald-700" : "text-rose-600"}`}>{result.message}</span>}
    </div>
  );
}
