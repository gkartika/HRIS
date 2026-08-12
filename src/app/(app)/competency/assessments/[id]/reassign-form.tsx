"use client";

import { useActionState, useState } from "react";
import { reassignCompetencyEvaluator } from "../../actions";

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  fullLegalName: string;
}

export function ReassignEvaluatorForm({
  assessmentId,
  slot,
  employees,
}: {
  assessmentId: string;
  slot: "P1" | "P2";
  employees: EmployeeOption[];
}) {
  const [open, setOpen] = useState(false);
  const [error, formAction, isPending] = useActionState(reassignCompetencyEvaluator.bind(null, assessmentId), undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs text-indigo-600 hover:underline">
        Ganti {slot}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="slot" value={slot} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">Karyawan Pengganti</label>
        <select name="newEmployeeId" required className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="">— Pilih Karyawan —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employeeNumber} — {e.fullLegalName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Alasan (wajib)</label>
        <textarea name="reason" required rows={2} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Simpan Penggantian"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">
          Batal
        </button>
      </div>
    </form>
  );
}
