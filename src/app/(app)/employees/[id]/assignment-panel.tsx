"use client";

import { useActionState } from "react";
import { addAssignment, movePrimaryAssignment, endAssignment } from "./assignment-actions";
import { t } from "@/lib/i18n/id";
import type { Position, Job, OrgUnit } from "@/generated/prisma/client";

type PositionOption = Position & { job: Job; orgUnit: OrgUnit };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function AddAssignmentForm({
  employeeId,
  positions,
}: {
  employeeId: string;
  positions: PositionOption[];
}) {
  const action = addAssignment.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Posisi</label>
        <select name="positionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Pilih posisi</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.job.jobTitle} — {p.orgUnit.unitName} ({p.positionCode})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis Penempatan</label>
        <select
          name="assignmentType"
          required
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="ADDITIONAL">{t("assignmentType.ADDITIONAL")}</option>
          <option value="ACTING">{t("assignmentType.ACTING")}</option>
          <option value="TEMPORARY">{t("assignmentType.TEMPORARY")}</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Berlaku Sejak</label>
        <input
          name="effectiveFrom"
          type="date"
          required
          defaultValue={todayIso()}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-600 md:col-span-4">{error}</p>}
      <div className="md:col-span-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : "Tambah Penempatan"}
        </button>
      </div>
    </form>
  );
}

function MoveForm({ employeeId, positions }: { employeeId: string; positions: PositionOption[] }) {
  const action = movePrimaryAssignment.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Posisi Utama Baru</label>
        <select name="positionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Pilih posisi</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.job.jobTitle} — {p.orgUnit.unitName} ({p.positionCode})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Efektif Sejak</label>
        <input
          name="effectiveFrom"
          type="date"
          required
          defaultValue={todayIso()}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : "Pindahkan"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600 md:col-span-4">{error}</p>}
      <p className="text-xs text-slate-400 md:col-span-4">
        Menutup Penempatan Utama saat ini pada tanggal efektif dan membuat Penempatan Utama baru.
        Riwayat lama tetap tersimpan, tidak ditimpa.
      </p>
    </form>
  );
}

function EndAssignmentForm({ assignmentId, employeeId }: { assignmentId: string; employeeId: string }) {
  const action = endAssignment.bind(null, assignmentId, employeeId);
  const [, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="effectiveTo" value={todayIso()} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
      >
        {isPending ? "..." : "Akhiri"}
      </button>
    </form>
  );
}

export function AssignmentManagementPanel({
  employeeId,
  positions,
  activeNonPrimaryAssignments,
}: {
  employeeId: string;
  positions: PositionOption[];
  activeNonPrimaryAssignments: { id: string; positionCode: string; assignmentType: string }[];
}) {
  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-sm font-medium text-slate-900">Tambah Penempatan Tambahan</h2>
        <p className="mt-1 text-xs text-slate-500">
          Untuk Penempatan Tambahan, Plt., atau Sementara — tidak menutup Penempatan Utama.
        </p>
        <div className="mt-3">
          <AddAssignmentForm employeeId={employeeId} positions={positions} />
        </div>
      </div>

      {activeNonPrimaryAssignments.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-xs font-medium text-slate-500">Akhiri Penempatan Non-Utama</h3>
          <div className="mt-2 space-y-2">
            {activeNonPrimaryAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span>
                  {a.positionCode} — {t(`assignmentType.${a.assignmentType}`)}
                </span>
                <EndAssignmentForm assignmentId={a.id} employeeId={employeeId} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <h2 className="text-sm font-medium text-slate-900">Pindahkan ke Posisi Baru (Ubah Utama)</h2>
        <p className="mt-1 text-xs text-slate-500">Untuk promosi, rotasi, atau mutasi.</p>
        <div className="mt-3">
          <MoveForm employeeId={employeeId} positions={positions} />
        </div>
      </div>
    </div>
  );
}
