"use client";

import { useActionState } from "react";
import { createOrgUnit } from "./actions";
import type { OrgUnit } from "@/generated/prisma/client";

const UNIT_TYPES = ["DEPARTMENT", "SECTION", "GROUP", "TEAM"];

export function CreateOrgUnitForm({ units }: { units: OrgUnit[] }) {
  const [error, formAction, isPending] = useActionState(createOrgUnit, undefined);

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-5"
    >
      <div>
        <label className="mb-1 block text-xs text-slate-500">Kode Unit</label>
        <input
          name="unitCode"
          required
          placeholder="DEPT-IT"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Unit</label>
        <input
          name="unitName"
          required
          placeholder="Teknologi Informasi"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Jenis</label>
        <select name="unitType" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {UNIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Induk Unit (opsional)</label>
        <select name="parentUnitId" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Tidak ada —</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Unit"}
        </button>
      </div>
      {error && <p className="col-span-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}
