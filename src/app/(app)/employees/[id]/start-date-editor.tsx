"use client";

import { useState, useTransition } from "react";
import { updateAssignmentStartDate } from "./assignment-actions";

// "Berlaku Sejak 15 Juni 2024  [Ubah]" in the placement history. Clicking Ubah
// turns the date into an input with Simpan / Batal, right where the date is
// shown. Only HR admins get this (the Penempatan tab passes it in only then).
export function StartDateEditor({
  employeeId,
  assignmentId,
  label,
  isoDate,
  positionCode,
}: {
  employeeId: string;
  assignmentId: string;
  label: string; // the date as shown today, e.g. "15 Juni 2024" or "—"
  isoDate: string; // YYYY-MM-DD, "" when none
  positionCode: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing(true);
          }}
          aria-label={`Ubah tanggal mulai ${positionCode}`}
          className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Ubah
        </button>
      </span>
    );
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const result = await updateAssignmentStartDate(employeeId, undefined, formData);
      if (result) setError(result);
      else setEditing(false);
    });
  }

  return (
    <form action={save} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input
        name="effectiveFrom"
        type="date"
        required
        autoFocus
        defaultValue={isoDate}
        aria-label={`Berlaku Sejak ${positionCode}`}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "..." : "Simpan"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={isPending}
        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        Batal
      </button>
      {error && <span className="basis-full text-xs text-rose-600">{error}</span>}
    </form>
  );
}
