"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { createPtkpStatus, renamePtkpStatus, togglePtkpStatus, movePtkpStatus } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";

export interface StatusRow {
  id: string;
  code: string;
  label: string;
  activeFlag: boolean;
}

function AddForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await createPtkpStatus(prev, fd);
    if (!result) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={formAction} className="grid grid-cols-1 gap-2 border-b border-slate-200 p-4 sm:grid-cols-[140px_1fr_auto]">
      <input
        name="code"
        required
        autoComplete="off"
        placeholder="mis. K/I/1"
        aria-label="Kode PTKP baru"
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <input
        name="label"
        required
        autoComplete="off"
        placeholder="mis. Kawin, Istri Bekerja, 1 Tanggungan"
        aria-label="Label PTKP baru"
        className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "+ Tambah"}
      </button>
      {error && <p className="text-xs text-rose-600 sm:col-span-3">{error}</p>}
    </form>
  );
}

function RenameForm({ row, onDone }: { row: StatusRow; onDone: () => void }) {
  const action = renamePtkpStatus.bind(null, row.id);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await action(prev, fd);
    if (!result) onDone();
    return result;
  }, undefined);

  return (
    <form action={formAction} className="flex flex-1 flex-wrap items-center gap-2">
      <span className="rounded-md bg-slate-100 px-2 py-1.5 font-mono text-xs text-slate-500">{row.code}</span>
      <input
        name="label"
        defaultValue={row.label}
        required
        autoFocus
        aria-label={`Ubah label ${row.code}`}
        className="min-w-0 flex-1 basis-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        Simpan
      </button>
      <button type="button" onClick={onDone} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
        Batal
      </button>
      {error && <p className="basis-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

function Row({ row, index, total }: { row: StatusRow; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toggleAction = togglePtkpStatus.bind(null, row.id);
  const [, toggleFormAction, isToggling] = useActionState(toggleAction, undefined);

  return (
    <li className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
      <div className="flex gap-0.5">
        <button
          type="button"
          aria-label="Naikkan"
          disabled={index === 0 || isPending}
          onClick={() => startTransition(() => movePtkpStatus(row.id, "up"))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          aria-label="Turunkan"
          disabled={index === total - 1 || isPending}
          onClick={() => startTransition(() => movePtkpStatus(row.id, "down"))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          <ArrowDown size={16} />
        </button>
      </div>
      {editing ? (
        <RenameForm row={row} onDone={() => setEditing(false)} />
      ) : (
        <>
          <span className="font-mono text-xs text-slate-500">{row.code}</span>
          <span className={`min-w-0 flex-1 text-sm font-medium ${row.activeFlag ? "text-slate-900" : "text-slate-400 line-through"}`}>
            {row.label}
          </span>
          <button
            type="button"
            aria-label={`Ubah label ${row.code}`}
            onClick={() => setEditing(true)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <Pencil size={16} />
          </button>
          <form action={toggleFormAction}>
            <input type="hidden" name="activeFlag" value={row.activeFlag ? "" : "on"} />
            {row.activeFlag ? (
              <ConfirmButton label="Nonaktifkan" pending={isToggling} className="text-xs text-indigo-600 hover:underline disabled:opacity-60" />
            ) : (
              <button type="submit" disabled={isToggling} className="text-xs text-indigo-600 hover:underline disabled:opacity-60">
                Aktifkan
              </button>
            )}
          </form>
        </>
      )}
    </li>
  );
}

export function StatusManager({ statuses }: { statuses: StatusRow[] }) {
  const active = statuses.filter((s) => s.activeFlag);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <AddForm />
        <ul>
          {statuses.map((s, i) => (
            <Row key={s.id} row={s} index={i} total={statuses.length} />
          ))}
          {statuses.length === 0 && (
            <li className="p-7 text-center text-sm text-slate-400">Belum ada kode PTKP. Tambahkan yang pertama di atas.</li>
          )}
        </ul>
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Kode PTKP tidak dihapus atau diubah kodenya — cukup dinonaktifkan, supaya data karyawan lama tetap terbaca.
          Labelnya bisa diubah kapan saja. Urutan di sini = urutan di dropdown.
        </p>
      </div>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Tampilan di data karyawan</h3>
        <label className="mt-3 mb-1 block text-xs text-slate-500">PTKP Pajak</label>
        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ring-2 ring-indigo-500 ring-offset-2" aria-label="Pratinjau dropdown">
          <option value="">— Pilih —</option>
          {active.map((s) => (
            <option key={s.id}>
              {s.code} — {s.label}
            </option>
          ))}
        </select>
        <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs text-slate-600">
          Dropdown ini langsung mengikuti daftar di kiri. Kode yang dinonaktifkan tidak muncul di form.
        </p>
      </aside>
    </div>
  );
}
