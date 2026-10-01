"use client";

import { useActionState } from "react";
import { addTaskForceMembership, endTaskForceMembership } from "./task-force-actions";

export interface TaskForceMembershipSummary {
  id: string;
  name: string;
  roleLabel: string | null;
  startDate: string;
  endDate: string | null;
}

function AddForm({ employeeId, existingNames }: { employeeId: string; existingNames: string[] }) {
  const action = addTaskForceMembership.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Satgas/Task Force</label>
        <input
          name="name"
          required
          list="task-force-names"
          placeholder="mis. Internal Audit"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <datalist id="task-force-names">
          {existingNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Peran (opsional)</label>
        <input name="roleLabel" placeholder="mis. Ketua, Anggota" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Berlaku Mulai</label>
        <input
          name="startDate"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Tambah"}
      </button>
    </form>
  );
}

function EndButton({ membershipId }: { membershipId: string }) {
  const action = endTaskForceMembership.bind(null, membershipId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="text-xs text-rose-600 hover:underline disabled:opacity-60">
        {isPending ? "..." : "Akhiri"}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}

export function TaskForcePanel({
  employeeId,
  canManage,
  active,
  ended,
  existingNames,
}: {
  employeeId: string;
  canManage: boolean;
  active: TaskForceMembershipSummary[];
  ended: TaskForceMembershipSummary[];
  existingNames: string[];
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-slate-900">Satgas / Task Force</h2>
      {active.length === 0 && ended.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">Belum tercatat dalam satgas/task force apapun.</p>
      )}
      {active.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {active.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-sm text-slate-700">
              <span>
                <span className="font-medium text-slate-900">{m.name}</span>
                {m.roleLabel && ` — ${m.roleLabel}`}
                <span className="ml-2 text-xs text-slate-400">sejak {m.startDate}</span>
              </span>
              {canManage && <EndButton membershipId={m.id} />}
            </li>
          ))}
        </ul>
      )}
      {ended.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <p className="text-xs text-slate-400">Riwayat</p>
          <ul className="mt-1 space-y-1">
            {ended.map((m) => (
              <li key={m.id} className="text-xs text-slate-400">
                {m.name}
                {m.roleLabel && ` — ${m.roleLabel}`} ({m.startDate} – {m.endDate})
              </li>
            ))}
          </ul>
        </div>
      )}
      {canManage && <AddForm employeeId={employeeId} existingNames={existingNames} />}
    </div>
  );
}
