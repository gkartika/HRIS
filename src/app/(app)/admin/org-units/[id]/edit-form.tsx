"use client";

import { useActionState } from "react";
import { updateOrgUnit } from "../actions";
import type { OrgUnit } from "@/generated/prisma/client";

const UNIT_TYPES = ["DEPARTMENT", "SECTION", "GROUP", "TEAM"];

export function EditOrgUnitForm({ unit, units }: { unit: OrgUnit; units: OrgUnit[] }) {
  const updateWithId = updateOrgUnit.bind(null, unit.id);
  const [error, formAction, isPending] = useActionState(updateWithId, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Kode Unit</label>
        <input
          name="unitCode"
          required
          defaultValue={unit.unitCode}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Unit</label>
        <input
          name="unitName"
          required
          defaultValue={unit.unitName}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis</label>
        <select
          name="unitType"
          defaultValue={unit.unitType}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {UNIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Induk Unit</label>
        <select
          name="parentUnitId"
          defaultValue={unit.parentUnitId ?? ""}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">— Tidak ada —</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitName}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activeFlag" defaultChecked={unit.activeFlag} />
        Aktif
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </form>
  );
}
