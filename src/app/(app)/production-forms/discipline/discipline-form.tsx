"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activeDisciplinesAction, saveDisciplineAction, type ActiveSp } from "../actions";
import { DISCIPLINE_LABEL, DISCIPLINE_ORDER, suggestedDisciplineKind } from "@/lib/production-forms";
import type { ProductionEmployee } from "@/lib/production-forms-service";
import type { DisciplineKind } from "@/generated/prisma/enums";
import { BTN_GHOST, BTN_PRIMARY, DatePick, EmployeeSelect, FIELD, wibIso } from "../ui";

export interface DisciplineInitial {
  id: string | null;
  employeeId: string;
  kind: DisciplineKind;
  incidentDate: string;
  description: string;
}

const dayMonths = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][m - 1]} ${y}`;
};

// Surat Peringatan in three steps: who (with the warnings still in force), what happened and which step, then a check.
export function DisciplineForm({ employees, initial, approvers }: { employees: ProductionEmployee[]; initial: DisciplineInitial; approvers: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [step, setStep] = useState<1 | 2 | 3>(initial.id ? 2 : 1);
  const [employeeId, setEmployeeId] = useState(initial.employeeId);
  const [kind, setKind] = useState<DisciplineKind>(initial.kind);
  const [kindTouched, setKindTouched] = useState(initial.id !== null);
  const [incidentDate, setIncidentDate] = useState(initial.incidentDate || wibIso(0));
  const [description, setDescription] = useState(initial.description);
  const [loaded, setLoaded] = useState<ActiveSp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const employee = employees.find((e) => e.id === employeeId);
  // The warnings in force belong to the chosen employee; nothing is shown before one is picked.
  const active = employeeId ? loaded : [];
  const suggested = suggestedDisciplineKind(active.map((a) => a.kind));

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    void activeDisciplinesAction(employeeId).then((rows) => {
      if (cancelled) return;
      setLoaded(rows);
      if (!kindTouched) setKind(suggestedDisciplineKind(rows.map((r) => r.kind)));
    });
    return () => {
      cancelled = true;
    };
  }, [employeeId, kindTouched]);

  function save(submit: boolean) {
    setError(null);
    run(async () => {
      const res = await saveDisciplineAction({ employeeId, kind, incidentDate, description }, initial.id, submit);
      if (res.error) setError(res.error);
      else if (res.href) router.push(res.href);
    });
  }

  const stepper = (
    <div className="mb-4 flex items-center gap-2 text-xs">
      {["Karyawan", "Pelanggaran", "Periksa"].map((label, i) => {
        const n = i + 1;
        return (
          <div key={label} className="flex items-center gap-2">
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${n < step ? "bg-emerald-500 text-white" : n === step ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"}`}>{n < step ? "✓" : n}</span>
            <span className={n === step ? "font-semibold text-slate-900" : "text-slate-400"}>{label}</span>
            {n < 3 && <span className="h-px w-6 bg-slate-300" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6">
      {stepper}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">Siapa karyawannya</p>
          <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} />
          {employeeId && (
            <div className={`rounded-lg border p-3 ${active.length ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
              <p className={`text-xs font-semibold ${active.length ? "text-amber-900" : "text-slate-600"}`}>SP aktif karyawan ini</p>
              {active.length === 0 ? (
                <p className="mt-1 text-sm text-slate-600">Belum ada. Semua jenis berlaku 6 bulan sejak diserahkan.</p>
              ) : (
                active.map((a) => (
                  <p key={a.requestNumber} className="mt-1 text-sm">
                    <b>{DISCIPLINE_LABEL[a.kind]}</b> · diserahkan {dayMonths(a.handedOverAt)} · berlaku sampai {dayMonths(a.validUntil)}
                  </p>
                ))
              )}
            </div>
          )}
          <div className="flex justify-end">
            <button type="button" className={BTN_PRIMARY} disabled={!employeeId} onClick={() => setStep(2)}>Lanjut: pelanggaran →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold">{employee?.name}</p>
            <p className="text-xs text-slate-500">{[employee?.section, employee?.group].filter(Boolean).join(" · ")}</p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">Jenis tindakan</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DISCIPLINE_ORDER.map((k) => {
                const have = active.some((a) => a.kind === k);
                const on = kind === k;
                return (
                  <button key={k} type="button" onClick={() => { setKind(k); setKindTouched(true); }} aria-pressed={on} className={`rounded-lg border-2 px-3 py-2 text-left ${on ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200"}`}>
                    <p className="text-sm font-semibold">{DISCIPLINE_LABEL[k]}</p>
                    <p className={`text-[11px] ${k === suggested ? "text-indigo-700" : "text-slate-400"}`}>{have ? "sudah ada" : k === suggested && active.length ? "disarankan" : "Berlaku 6 bulan"}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">Tanggal kejadian</p>
            <DatePick value={incidentDate} onChange={setIncidentDate} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700">Apa yang terjadi (wajib)</p>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} aria-label="Uraian pelanggaran" className={FIELD} />
            <p className="mt-1 text-[11px] text-slate-400">Tuliskan kapan, di mana, dan apa yang dilakukan. Contoh: &quot;Rabu 28 Okt, shift 2, meninggalkan mesin CNC 3 selama 30 menit saat produksi berjalan.&quot;</p>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className={BTN_GHOST} onClick={() => setStep(1)}>← Kembali</button>
            <div className="flex gap-2">
              <button type="button" className={BTN_GHOST} onClick={() => save(false)} disabled={pending || !incidentDate}>Simpan draf</button>
              <button type="button" className={BTN_PRIMARY} disabled={description.trim().length < 10 || !incidentDate} onClick={() => setStep(3)}>Lanjut: periksa →</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div><p className="text-[11px] text-slate-500">Karyawan</p><p className="font-medium">{employee?.name}</p></div>
            <div><p className="text-[11px] text-slate-500">Jenis</p><p className="font-medium">{DISCIPLINE_LABEL[kind]}</p></div>
            <div><p className="text-[11px] text-slate-500">Tanggal kejadian</p><p className="font-medium">{dayMonths(incidentDate)}</p></div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm"><p className="text-[11px] text-slate-500">Uraian</p><p className="whitespace-pre-line">{description}</p></div>
          {kind !== suggested && active.length > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Perhatian: tingkat yang disarankan karena ada SP aktif adalah {DISCIPLINE_LABEL[suggested]}. Anda memilih {DISCIPLINE_LABEL[kind]}.</p>}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
            <b>Apa yang terjadi berikutnya:</b> {approvers} memutuskan. Bila disetujui, Admin SDM menyerahkan SP ke karyawan, dan masa berlaku 6 bulan dihitung dari tanggal diserahkan.
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className={BTN_GHOST} onClick={() => setStep(2)} disabled={pending}>← Ubah lagi</button>
            <button type="button" className={BTN_PRIMARY} onClick={() => save(true)} disabled={pending}>{pending ? "Mengajukan…" : "Ajukan sekarang"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
