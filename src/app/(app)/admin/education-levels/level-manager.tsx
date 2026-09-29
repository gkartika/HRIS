"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { createEducationLevel, renameEducationLevel, toggleEducationLevel, moveEducationLevel } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";

export interface LevelRow {
  id: string;
  label: string;
  activeFlag: boolean;
}

function AddForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await createEducationLevel(prev, fd);
    if (!result) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={formAction} className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
      <input
        name="label"
        required
        autoComplete="off"
        placeholder="mis. Profesi"
        aria-label="Nama tingkat pendidikan baru"
        className="min-w-0 flex-1 basis-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "+ Tambah"}
      </button>
      {error && <p className="basis-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

function RenameForm({ row, onDone }: { row: LevelRow; onDone: () => void }) {
  const action = renameEducationLevel.bind(null, row.id);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await action(prev, fd);
    if (!result) onDone();
    return result;
  }, undefined);

  return (
    <form action={formAction} className="flex flex-1 flex-wrap gap-2">
      <input
        name="label"
        defaultValue={row.label}
        required
        autoFocus
        aria-label="Ubah nama tingkat pendidikan"
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

function Row({ row, index, total }: { row: LevelRow; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toggleAction = toggleEducationLevel.bind(null, row.id);
  const [, toggleFormAction, isToggling] = useActionState(toggleAction, undefined);

  return (
    <li className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
      <div className="flex gap-0.5">
        <button
          type="button"
          aria-label="Naikkan"
          disabled={index === 0 || isPending}
          onClick={() => startTransition(() => moveEducationLevel(row.id, "up"))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          aria-label="Turunkan"
          disabled={index === total - 1 || isPending}
          onClick={() => startTransition(() => moveEducationLevel(row.id, "down"))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          <ArrowDown size={16} />
        </button>
      </div>
      {editing ? (
        <RenameForm row={row} onDone={() => setEditing(false)} />
      ) : (
        <>
          <span className={`min-w-0 flex-1 text-sm font-medium ${row.activeFlag ? "text-slate-900" : "text-slate-400 line-through"}`}>
            {row.label}
          </span>
          <button
            type="button"
            aria-label="Ubah"
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

export function LevelManager({ levels }: { levels: LevelRow[] }) {
  const active = levels.filter((l) => l.activeFlag);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <AddForm />
        <ul>
          {levels.map((l, i) => (
            <Row key={l.id} row={l} index={i} total={levels.length} />
          ))}
          {levels.length === 0 && (
            <li className="p-7 text-center text-sm text-slate-400">Belum ada tingkat pendidikan. Tambahkan yang pertama di atas.</li>
          )}
        </ul>
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Tingkat pendidikan tidak dihapus — cukup dinonaktifkan, supaya data karyawan lama tetap terbaca. Urutan di sini
          = urutan di dropdown.
        </p>
      </div>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Tampilan di data karyawan</h3>
        <label className="mt-3 mb-1 block text-xs text-slate-500">Pendidikan Terakhir</label>
        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ring-2 ring-indigo-500 ring-offset-2" aria-label="Pratinjau dropdown">
          <option value="">— Pilih —</option>
          {active.map((l) => (
            <option key={l.id}>{l.label}</option>
          ))}
        </select>
        <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs text-slate-600">
          Dropdown ini langsung mengikuti daftar di kiri. Tingkat yang dinonaktifkan tidak muncul di form.
        </p>
      </aside>
    </div>
  );
}
