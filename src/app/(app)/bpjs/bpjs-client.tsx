"use client";

import { useState, useTransition } from "react";
import { markBpjsDoneAction, saveStartDatesAction, undoBpjsMarkAction } from "./actions";

const BTN = "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60";
const BTN_LIGHT = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";

export function PrintButton() {
  return (
    <button type="button" className={BTN_LIGHT} onClick={() => window.print()}>
      Cetak
    </button>
  );
}

// "Sudah didaftarkan semua" of the monthly list.
export function MarkDoneButton({ taskKey, label }: { taskKey: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <div className="print:hidden">
      <button
        type="button"
        className={BTN}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await markBpjsDoneAction(taskKey);
            setError(r.error);
          })
        }
      >
        {pending ? "Menyimpan..." : label}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function UndoButton({ taskKey }: { taskKey: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className={BTN_LIGHT} disabled={pending} onClick={() => startTransition(async () => void (await undoBpjsMarkAction(taskKey)))}>
      {pending ? "..." : "Batalkan"}
    </button>
  );
}

export interface MissingRow {
  id: string;
  name: string;
  status: string;
  section: string;
}

// One date field per person; one button saves every filled field. "Isi semua dengan tanggal ini" fills the empty fields at once.
export function StartDatesForm({ rows }: { rows: MissingRow[] }) {
  const [dates, setDates] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | undefined>();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const shown = rows.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));
  const filled = rows.filter((r) => dates[r.id]).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Cari nama
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="Nama..." />
        </label>
        <label className="text-xs text-slate-600">
          Satu tanggal untuk yang tampil dan masih kosong
          <input type="date" value={bulk} onChange={(e) => setBulk(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </label>
        <button
          type="button"
          className={BTN_LIGHT}
          disabled={!bulk}
          onClick={() => setDates((prev) => ({ ...prev, ...Object.fromEntries(shown.filter((r) => !prev[r.id]).map((r) => [r.id, bulk])) }))}
        >
          Isi yang kosong
        </button>
      </div>
      <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Bagian</th>
              <th className="px-3 py-2">Tanggal masuk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5 font-medium text-slate-900">{r.name}</td>
                <td className="px-3 py-1.5 text-slate-600">{r.status}</td>
                <td className="px-3 py-1.5 text-slate-600">{r.section}</td>
                <td className="px-3 py-1.5">
                  <input type="date" value={dates[r.id] ?? ""} onChange={(e) => setDates((prev) => ({ ...prev, [r.id]: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada yang cocok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={BTN}
          disabled={pending || filled === 0}
          onClick={() =>
            startTransition(async () => {
              const r = await saveStartDatesAction(rows.filter((x) => dates[x.id]).map((x) => ({ id: x.id, date: dates[x.id] })));
              if (r.error) setMessage({ text: r.error, ok: false });
              else {
                setMessage({ text: `${r.saved} tanggal masuk tersimpan.`, ok: true });
                setDates({});
              }
            })
          }
        >
          {pending ? "Menyimpan..." : `Simpan ${filled} tanggal`}
        </button>
        {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-rose-600"}`}>{message.text}</p>}
      </div>
    </div>
  );
}
