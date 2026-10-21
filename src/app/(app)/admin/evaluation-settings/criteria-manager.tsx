"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { addCriterionAction, moveCriterionAction, renameCriterionAction, toggleCriterionAction } from "./actions";
import type { EvaluationSection } from "@/generated/prisma/enums";

export interface CriterionRow {
  id: string;
  label: string;
  active: boolean;
}

function AddForm({ section }: { section: EvaluationSection }) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await addCriterionAction(section, prev, fd);
    if (!result) ref.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={ref} action={formAction} className="flex flex-wrap gap-2 border-t border-slate-200 p-4">
      <input
        name="label"
        required
        autoComplete="off"
        placeholder="mis. Inisiatif"
        aria-label="Kriteria baru"
        className="min-w-0 flex-1 basis-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {isPending ? "Menyimpan..." : "+ Tambah kriteria"}
      </button>
      {error && <p className="basis-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

function RenameForm({ row, onDone }: { row: CriterionRow; onDone: () => void }) {
  const action = renameCriterionAction.bind(null, row.id);
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
        aria-label="Ubah nama kriteria"
        className="min-w-0 flex-1 basis-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        Simpan
      </button>
      <button type="button" onClick={onDone} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
        Batal
      </button>
      {error && <p className="basis-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

function Row({ row, index, total, onError }: { row: CriterionRow; index: number; total: number; onError: (message: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchLabel = row.active ? "Aktif — klik untuk nonaktifkan" : "Nonaktif — klik untuk aktifkan";

  function run(task: () => Promise<string | undefined>) {
    onError(null);
    startTransition(async () => {
      const message = await task();
      if (message) onError(message);
    });
  }

  return (
    <li className="flex items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0">
      <div className="flex gap-0.5">
        <button type="button" aria-label="Naikkan" disabled={index === 0 || isPending} onClick={() => run(() => moveCriterionAction(row.id, "up"))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
          <ArrowUp size={16} />
        </button>
        <button type="button" aria-label="Turunkan" disabled={index === total - 1 || isPending} onClick={() => run(() => moveCriterionAction(row.id, "down"))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
          <ArrowDown size={16} />
        </button>
      </div>
      {editing ? (
        <RenameForm row={row} onDone={() => setEditing(false)} />
      ) : (
        <>
          <span className={`min-w-0 flex-1 text-sm font-medium ${row.active ? "text-slate-900" : "text-slate-400 line-through"}`}>{row.label}</span>
          <button type="button" aria-label="Ubah nama" onClick={() => setEditing(true)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <Pencil size={16} />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={row.active}
            aria-label={switchLabel}
            title={switchLabel}
            disabled={isPending}
            onClick={() => run(() => toggleCriterionAction(row.id, !row.active))}
            className={`relative h-[22px] w-[38px] flex-none rounded-full transition-colors ${row.active ? "bg-emerald-600" : "bg-slate-300"}`}
          >
            <span className={`absolute left-[3px] top-[3px] h-4 w-4 rounded-full bg-white transition-transform ${row.active ? "translate-x-4" : ""}`} />
          </button>
        </>
      )}
    </li>
  );
}

// One section of the matrix: its fixed rules on top, the criteria list (changes save at once), and a form to add.
export function CriteriaSectionManager({
  section,
  title,
  rulesText,
  rows,
}: {
  section: EvaluationSection;
  title: string;
  rulesText: string;
  rows: CriterionRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const activeCount = rows.filter((r) => r.active).length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{rulesText}</p>
        <p className="mt-1 text-xs text-slate-400">
          {activeCount} kriteria aktif{rows.length > activeCount ? `, ${rows.length - activeCount} nonaktif` : ""}
        </p>
      </div>
      {error && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>}
      <ul>
        {rows.map((row, i) => (
          <Row key={row.id} row={row} index={i} total={rows.length} onError={setError} />
        ))}
      </ul>
      <AddForm section={section} />
    </section>
  );
}
