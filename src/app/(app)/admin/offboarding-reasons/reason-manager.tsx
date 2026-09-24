"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import {
  createOffboardingReason,
  renameOffboardingReason,
  toggleOffboardingReason,
  moveOffboardingReason,
} from "./actions";

export interface ReasonRow {
  id: string;
  label: string;
  activeFlag: boolean;
}

function AddForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await createOffboardingReason(prev, fd);
    if (!result) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={formAction} className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
      <input
        id="new-reason"
        name="label"
        required
        autoComplete="off"
        placeholder="mis. Dipindahkan ke anak perusahaan"
        aria-label="Alasan baru"
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

function RenameForm({ row, onDone }: { row: ReasonRow; onDone: () => void }) {
  const action = renameOffboardingReason.bind(null, row.id);
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
        aria-label="Ubah alasan"
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

function Row({ row, index, total }: { row: ReasonRow; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchLabel = row.activeFlag ? "Aktif — klik untuk nonaktifkan" : "Nonaktif — klik untuk aktifkan";

  return (
    <li className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
      <div className="flex gap-0.5">
        <button
          type="button"
          aria-label="Naikkan"
          disabled={index === 0 || isPending}
          onClick={() => startTransition(() => moveOffboardingReason(row.id, "up"))}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          aria-label="Turunkan"
          disabled={index === total - 1 || isPending}
          onClick={() => startTransition(() => moveOffboardingReason(row.id, "down"))}
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
          <button
            type="button"
            role="switch"
            aria-checked={row.activeFlag}
            aria-label={switchLabel}
            title={switchLabel}
            disabled={isPending}
            onClick={() => startTransition(() => toggleOffboardingReason(row.id, !row.activeFlag))}
            className={`relative h-[22px] w-[38px] flex-none rounded-full transition-colors ${row.activeFlag ? "bg-emerald-600" : "bg-slate-300"}`}
          >
            <span
              className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-white transition-transform ${row.activeFlag ? "translate-x-4" : ""}`}
            />
          </button>
        </>
      )}
    </li>
  );
}

export function ReasonManager({ reasons }: { reasons: ReasonRow[] }) {
  const active = reasons.filter((r) => r.activeFlag);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <AddForm />
        <ul>
          {reasons.map((r, i) => (
            <Row key={r.id} row={r} index={i} total={reasons.length} />
          ))}
          {reasons.length === 0 && (
            <li className="p-7 text-center text-sm text-slate-400">Belum ada alasan. Tambahkan yang pertama di atas.</li>
          )}
        </ul>
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Alasan tidak dihapus — cukup dinonaktifkan, supaya kasus lama tetap menampilkan alasannya. Urutan di sini =
          urutan di dropdown.
        </p>
      </div>

      <aside className="rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Tampilan di form Mulai Offboarding</h3>
        <label className="mt-3 mb-1 block text-xs text-slate-500">Alasan *</label>
        <select
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm ring-2 ring-indigo-500 ring-offset-2"
          aria-label="Pratinjau dropdown"
        >
          <option value="">— Pilih alasan —</option>
          {active.map((r) => (
            <option key={r.id}>{r.label}</option>
          ))}
        </select>
        <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs text-slate-600">
          Dropdown ini langsung mengikuti daftar di kiri. Alasan yang dinonaktifkan tidak muncul di form.
        </p>
      </aside>
    </div>
  );
}
