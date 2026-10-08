"use client";

import { useActionState } from "react";
import { addAssignment, movePrimaryAssignment, endAssignment, updatePositionReportsTo } from "./assignment-actions";
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
        Riwayat lama tetap tersimpan, tidak ditimpa. Jika tanggal efektif di masa depan, penempatan saat ini tetap
        berlaku sampai tanggal itu lalu berpindah otomatis; jadwal bisa dibatalkan sebelum berlaku.
      </p>
    </form>
  );
}

function ReportsToForm({
  employeeId,
  positions,
  currentReportsToPositionId,
}: {
  employeeId: string;
  positions: PositionOption[];
  currentReportsToPositionId: string | null;
}) {
  const action = updatePositionReportsTo.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-slate-500">Melapor Kepada</label>
        <select
          name="reportsToPositionId"
          defaultValue={currentReportsToPositionId ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Puncak hierarki —</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.job.jobTitle} — {p.orgUnit.unitName} ({p.positionCode})
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : "Simpan"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600 md:col-span-4">{error}</p>}
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
  extraAssignmentPositions,
  activeNonPrimaryAssignments,
  hasCurrentPosition,
  currentReportsToPositionId,
}: {
  employeeId: string;
  positions: PositionOption[];
  extraAssignmentPositions: PositionOption[];
  activeNonPrimaryAssignments: { id: string; positionCode: string; assignmentType: string }[];
  hasCurrentPosition: boolean;
  currentReportsToPositionId: string | null;
}) {
  return (
    <div className="space-y-4">
      <details className="group rounded-lg border border-slate-100 p-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">
          + Tambah Penempatan Tambahan
        </summary>
        <p className="mt-1 text-xs text-slate-500">
          Untuk Penempatan Tambahan atau Sementara di departemen yang sama — tidak menutup Penempatan Utama.
        </p>
        <div className="mt-3">
          <AddAssignmentForm employeeId={employeeId} positions={extraAssignmentPositions} />
        </div>
      </details>

      {hasCurrentPosition && (
        <details className="group rounded-lg border border-slate-100 p-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">
            + Ubah Melapor Kepada
          </summary>
          <p className="mt-1 text-xs text-slate-500">Mengubah jalur pelaporan Posisi Utama karyawan ini secara langsung.</p>
          <div className="mt-3">
            <ReportsToForm
              employeeId={employeeId}
              positions={positions}
              currentReportsToPositionId={currentReportsToPositionId}
            />
          </div>
        </details>
      )}

      {activeNonPrimaryAssignments.length > 0 && (
        <div className="rounded-lg border border-slate-100 p-4">
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

      <details className="group rounded-lg border border-slate-100 p-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">
          + Pindahkan ke Posisi Baru (Ubah Utama)
        </summary>
        <p className="mt-1 text-xs text-slate-500">Untuk promosi, rotasi, atau mutasi.</p>
        <div className="mt-3">
          <MoveForm employeeId={employeeId} positions={positions} />
        </div>
      </details>
    </div>
  );
}
