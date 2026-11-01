"use client";

import { useState } from "react";
import type { ProductionEmployee } from "@/lib/production-forms-service";

// Small building blocks shared by the three Admin Produksi forms: quick-pick chips, a two-way switch, reason chips and a
// search-and-pick for Production employees. Pick instead of type wherever the answer is one of a few.

export const FIELD = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400";
export const BTN_PRIMARY = "rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
export const BTN_GHOST = "rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function Chip({ on, onClick, children }: { on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!on} className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {children}
    </button>
  );
}

export function Switch<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-sm" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value} className={`rounded-md px-4 py-1.5 ${value === o.value ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-500"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">{n}</span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// Date as yyyy-mm-dd in the company's day (WIB), with Hari ini / Kemarin / Besok.
export function wibIso(offsetDays = 0): string {
  const wib = new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400000);
  return wib.toISOString().slice(0, 10);
}

export function DatePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = wibIso(0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip on={value === wibIso(0)} onClick={() => onChange(wibIso(0))}>Hari ini</Chip>
      <Chip on={value === wibIso(-1)} onClick={() => onChange(wibIso(-1))}>Kemarin</Chip>
      <Chip on={value === wibIso(1)} onClick={() => onChange(wibIso(1))}>Besok</Chip>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" aria-label="Pilih tanggal" />
      {value && value !== today && <span className="text-xs text-slate-400">{value > today ? "tanggal yang akan datang" : "tanggal yang sudah lewat"}</span>}
    </div>
  );
}

export function ReasonPick({ choices, value, onChange }: { choices: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c) => (
          <Chip key={c} on={value.startsWith(c)} onClick={() => onChange(c)}>
            {c}
          </Chip>
        ))}
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="Tulis alasannya. Wajib diisi." aria-label="Alasan" className={`${FIELD} mt-2`} />
    </div>
  );
}

export function matches(e: ProductionEmployee, q: string, section: string | null): boolean {
  if (section && e.section !== section) return false;
  const t = q.trim().toLowerCase();
  return !t || e.name.toLowerCase().includes(t) || e.employeeNumber.toLowerCase().includes(t);
}

// One employee out of the Production list: search by name or NIP.
export function EmployeeSelect({ employees, value, onChange }: { employees: ProductionEmployee[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const chosen = employees.find((e) => e.id === value);
  const shown = q.trim() ? employees.filter((e) => matches(e, q, null)).slice(0, 8) : [];
  return (
    <div>
      {chosen ? (
        <div className="flex items-center justify-between rounded-lg border border-indigo-300 bg-indigo-50/50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-900">{chosen.name}</p>
            <p className="text-xs text-slate-500">
              {[chosen.section, chosen.group, chosen.employeeNumber].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" onClick={() => onChange("")} className="text-xs text-indigo-600 hover:underline">
            Ganti
          </button>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NIP karyawan Production" aria-label="Cari karyawan" className={FIELD} />
          {shown.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {shown.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => { onChange(e.id); setQ(""); }} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
                    <span className="text-sm font-medium text-slate-900">{e.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{[e.section, e.group].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim() && shown.length === 0 && <p className="mt-1 text-xs text-slate-400">Tidak ada karyawan Production dengan nama atau NIP itu.</p>}
        </>
      )}
    </div>
  );
}
