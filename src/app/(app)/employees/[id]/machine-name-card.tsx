"use client";

import { useActionState, useState, useTransition } from "react";
import { clearMachineName, setMachineName } from "./machine-name-actions";

// "Nama di mesin absensi" on the Akun tab: most employees use their full name; Admin SDM sets a different name for the few
// the machine writes shorter. Same data the fingerprint import matches by.
export function MachineNameCard({ employeeId, fullName, machineName, canManage }: { employeeId: string; fullName: string; machineName: string | null; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const save = setMachineName.bind(null, employeeId);
  const [error, formAction, isPending] = useActionState(async (prev: string | undefined, fd: FormData) => {
    const result = await save(prev, fd);
    if (!result) setEditing(false);
    return result;
  }, undefined);

  return (
    <div>
      <h2 className="text-sm font-medium text-slate-900">Nama di mesin absensi</h2>
      {editing ? (
        <form action={formAction} className="mt-2 max-w-md space-y-2">
          <p className="text-xs text-slate-500">Nama utama: {fullName}</p>
          <div>
            <label htmlFor="machineName" className="mb-1 block text-xs text-slate-500">
              Nama seperti tertulis di mesin
            </label>
            <input
              id="machineName"
              name="machineName"
              defaultValue={machineName ?? ""}
              maxLength={100}
              autoFocus
              autoComplete="off"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Huruf besar atau kecil dan spasi ganda tidak berpengaruh.</p>
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Batal
            </button>
          </div>
        </form>
      ) : machineName ? (
        <div className="mt-2 text-sm text-slate-600">
          <p>Nama khusus di mesin:</p>
          <p className="font-medium text-slate-900">{machineName}</p>
          <p className="mt-1 text-xs text-slate-500">Nama utama: {fullName}. Keduanya dikenali saat impor absensi.</p>
          {canManage && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                Ubah
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => {
                  setRemoveError(null);
                  startRemove(async () => {
                    const result = await clearMachineName(employeeId);
                    if (result) setRemoveError(result);
                  });
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Pakai nama utama lagi
              </button>
            </div>
          )}
          {removeError && <p className="mt-2 text-xs text-rose-600">{removeError}</p>}
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-600">
          <p>Memakai nama utama di SAPA:</p>
          <p className="font-medium text-slate-900">{fullName}</p>
          <p className="mt-1 text-xs text-slate-500">Impor absensi mencocokkan nama di mesin dengan nama ini.</p>
          {canManage && (
            <button type="button" onClick={() => setEditing(true)} className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Atur nama berbeda di mesin
            </button>
          )}
        </div>
      )}
    </div>
  );
}
