"use client";

import { useActionState } from "react";
import { createOnboardingCaseManually } from "../actions";
import type { Employee } from "@/generated/prisma/client";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateOnboardingForm({ employees }: { employees: Employee[] }) {
  const [error, formAction, isPending] = useActionState(createOnboardingCaseManually, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-xs text-slate-500">Nama Lengkap (sesuai dokumen resmi)</label>
        <select name="employeeId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullLegalName} ({e.employeeNumber})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Tanggal Mulai Direncanakan</label>
        <input
          name="plannedStartDate"
          type="date"
          required
          defaultValue={todayIso()}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Buat Onboarding"}
      </button>
    </form>
  );
}
