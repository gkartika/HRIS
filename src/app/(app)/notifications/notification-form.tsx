"use client";

import { useActionState } from "react";
import { saveNotificationPrefs, type NotificationPrefsState } from "./actions";
import { setPendingState } from "@/lib/pending-count-store";
import type { NotificationPrefs } from "@/lib/notification-prefs";

const OPTIONS: { name: keyof NotificationPrefs; title: string; hint: string }[] = [
  {
    name: "icon",
    title: "Angka di ikon aplikasi",
    hint: "Untuk yang sudah memasang aplikasi. Angka muncul di ikon (taskbar, dock, atau layar utama) dan hilang sendiri saat semua sudah diputuskan.",
  },
  { name: "menu", title: "Angka di menu Beranda", hint: "Penanda merah di samping menu Beranda saat aplikasi dibuka." },
  { name: "tab", title: "Angka di judul tab browser", hint: "Contoh: (3) Aplikasi HC. Berguna jika Anda membuka lewat browser tanpa memasang aplikasi." },
];

export function NotificationForm({ initial }: { initial: NotificationPrefs }) {
  const [state, formAction, isPending] = useActionState(async (prev: NotificationPrefsState, formData: FormData) => {
    const result = await saveNotificationPrefs(prev, formData);
    // Apply right away on this device; other devices pick it up on their next refresh.
    if (result) setPendingState(result.prefs);
    return result;
  }, undefined);
  const current = state?.prefs ?? initial;

  return (
    <form action={formAction} className="max-w-xl space-y-1 rounded-xl border border-slate-200 bg-white p-6">
      {OPTIONS.map((o) => (
        <label key={o.name} className="flex cursor-pointer items-start justify-between gap-4 border-t border-slate-100 py-4 first:border-t-0 first:pt-0">
          <span>
            <span className="block text-sm font-medium text-slate-900">{o.title}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{o.hint}</span>
          </span>
          <span className="relative mt-0.5 inline-block h-6 w-11 shrink-0">
            <input
              type="checkbox"
              role="switch"
              name={o.name}
              defaultChecked={current[o.name]}
              className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />
            <span className="pointer-events-none absolute inset-0 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
            <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </span>
        </label>
      ))}
      {state?.saved && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Pengaturan tersimpan.
        </p>
      )}
      <div className="pt-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}
