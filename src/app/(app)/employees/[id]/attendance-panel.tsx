"use client";

import { useActionState, useState } from "react";
import { setAttendanceAssignment } from "./attendance-actions";

export interface AttendanceAssignmentSummary {
  method: "MOBILE" | "FINGERPRINT";
  geofenceName: string | null;
  fingerprintDeviceUserId: string | null;
  effectiveFrom: string;
}

const METHOD_LABEL: Record<string, string> = { MOBILE: "Mobile (GPS)", FINGERPRINT: "Fingerprint (Impor)" };

function AssignmentForm({
  employeeId,
  geofences,
}: {
  employeeId: string;
  geofences: { id: string; siteName: string }[];
}) {
  const action = setAttendanceAssignment.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(action, undefined);
  const [method, setMethod] = useState<"MOBILE" | "FINGERPRINT">("MOBILE");

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Metode Absensi</label>
          <select
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value as "MOBILE" | "FINGERPRINT")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="MOBILE">{METHOD_LABEL.MOBILE}</option>
            <option value="FINGERPRINT">{METHOD_LABEL.FINGERPRINT}</option>
          </select>
        </div>
        {method === "MOBILE" && (
          <div>
            <label className="mb-1 block text-xs text-slate-500">Lokasi Absensi (opsional)</label>
            <select name="geofenceId" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">— Tanpa batas lokasi —</option>
              {geofences.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.siteName}
                </option>
              ))}
            </select>
          </div>
        )}
        {method === "FINGERPRINT" && (
          <div>
            <label className="mb-1 block text-xs text-slate-500">ID Perangkat Fingerprint</label>
            <input
              name="fingerprintDeviceUserId"
              required
              placeholder="ID pada mesin fingerprint"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-slate-500">Berlaku Mulai</label>
          <input
            name="effectiveFrom"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan Penugasan Absensi"}
      </button>
    </form>
  );
}

export function AttendanceAssignmentPanel({
  employeeId,
  canManage,
  current,
  geofences,
}: {
  employeeId: string;
  canManage: boolean;
  current: AttendanceAssignmentSummary | null;
  geofences: { id: string; siteName: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-medium text-slate-900">Penugasan Absensi</h2>
      {current ? (
        <div className="mt-2 text-sm text-slate-600">
          <p>
            Metode: <span className="font-medium text-slate-900">{METHOD_LABEL[current.method]}</span>
          </p>
          {current.geofenceName && <p>Lokasi: {current.geofenceName}</p>}
          {current.fingerprintDeviceUserId && <p>ID Perangkat: {current.fingerprintDeviceUserId}</p>}
          <p className="text-xs text-slate-400">Berlaku sejak {current.effectiveFrom}</p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Belum ada penugasan absensi.</p>
      )}
      {canManage && <AssignmentForm employeeId={employeeId} geofences={geofences} />}
    </div>
  );
}
