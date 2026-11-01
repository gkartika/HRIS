"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExtraWorkAction } from "../actions";
import { extraWorkAmountProblem, formatAmount, hoursBetween, parseAmount } from "@/lib/production-forms";
import type { ProductionEmployee } from "@/lib/production-forms-service";
import { BTN_GHOST, BTN_PRIMARY, Chip, DatePick, FIELD, matches, ReasonPick, Step, Switch, wibIso } from "../ui";

export interface ExtraWorkInitial {
  id: string | null;
  workDate: string;
  unit: "HOURS" | "WORKDAYS";
  reason: string;
  lines: { employeeId: string; startTime: string; endTime: string; amount: string }[];
}

interface Row {
  start: string;
  end: string;
  amount: string;
}

const REASONS = ["Mengejar target pesanan", "Mesin rusak atau perbaikan", "Pengganti karyawan yang tidak masuk", "Persiapan kirim barang"];

// Tambahan jam kerja: when, who (several at once), why. The length is worked out from the start and end times, or typed.
export function ExtraWorkForm({ employees, initial, lastTeam, approvers }: { employees: ProductionEmployee[]; initial: ExtraWorkInitial; lastTeam: string[]; approvers: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [workDate, setWorkDate] = useState(initial.workDate || wibIso(0));
  const [unit, setUnit] = useState<"HOURS" | "WORKDAYS">(initial.unit);
  const [reason, setReason] = useState(initial.reason);
  const [rows, setRows] = useState<Record<string, Row>>(Object.fromEntries(initial.lines.map((l) => [l.employeeId, { start: l.startTime, end: l.endTime, amount: l.amount }])));
  const [q, setQ] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [allStart, setAllStart] = useState("");
  const [allEnd, setAllEnd] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => [...new Set(employees.map((e) => e.section).filter((s): s is string => !!s))].sort(), [employees]);
  const byId = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const visible = employees.filter((e) => matches(e, q, section));
  const selectedIds = Object.keys(rows);

  function toggle(id: string) {
    setRows((r) => {
      const next = { ...r };
      if (next[id]) delete next[id];
      else next[id] = { start: allStart, end: allEnd, amount: unit === "HOURS" && allStart && allEnd ? String(hoursBetween(allStart, allEnd) ?? "") : "" };
      return next;
    });
  }
  function setRow(id: string, patch: Partial<Row>) {
    setRows((r) => {
      const cur = { ...r[id], ...patch };
      // The length follows the times as long as both are valid; typing the length by hand wins until the times change.
      if (("start" in patch || "end" in patch) && unit === "HOURS") {
        const h = hoursBetween(cur.start, cur.end);
        if (h !== null) cur.amount = String(h).replace(".", ",");
      }
      return { ...r, [id]: cur };
    });
  }
  function applyToAll() {
    setRows((r) => Object.fromEntries(Object.entries(r).map(([id, row]) => [id, { ...row, start: allStart, end: allEnd, amount: unit === "HOURS" ? String(hoursBetween(allStart, allEnd) ?? row.amount).replace(".", ",") : row.amount }])));
  }
  function useLastTeam() {
    setRows((r) => {
      const next = { ...r };
      for (const id of lastTeam) if (byId.has(id) && !next[id]) next[id] = { start: allStart, end: allEnd, amount: "" };
      return next;
    });
  }

  const parsed = selectedIds.map((id) => ({ id, ...rows[id], value: parseAmount(rows[id].amount) }));
  const total = parsed.reduce((s, p) => s + (p.value ?? 0), 0);
  const problem = (() => {
    if (!workDate) return "Pilih tanggalnya.";
    if (selectedIds.length === 0) return "Pilih sedikitnya satu karyawan.";
    for (const p of parsed) {
      const m = extraWorkAmountProblem(unit, p.value);
      if (m) return `${byId.get(p.id)?.name ?? "Karyawan"}: ${m}`;
    }
    if (reason.trim().length < 3) return "Alasan wajib diisi.";
    return null;
  })();

  function save(submit: boolean) {
    setError(null);
    run(async () => {
      const res = await saveExtraWorkAction(
        { workDate, unit, reason, lines: parsed.map((p) => ({ employeeId: p.id, startTime: p.start || null, endTime: p.end || null, amount: p.value })) },
        initial.id,
        submit
      );
      if (res.error) setError(res.error);
      else if (res.href) router.push(res.href);
    });
  }

  if (review) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Form Tambahan Jam Kerja</p>
          <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div><p className="text-[11px] text-slate-500">Tanggal</p><p className="font-medium">{workDate}</p></div>
            <div><p className="text-[11px] text-slate-500">Dihitung dalam</p><p className="font-medium">{unit === "HOURS" ? "Jam" : "Hari kerja"}</p></div>
            <div><p className="text-[11px] text-slate-500">Total</p><p className="font-medium">{selectedIds.length} karyawan, {formatAmount(total, unit)}</p></div>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {parsed.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{byId.get(p.id)?.name}</td>
                  <td className="py-2 text-slate-500">{p.start && p.end ? `${p.start} – ${p.end}` : ""}</td>
                  <td className="py-2 text-right tabular-nums">{formatAmount(p.value ?? 0, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p className="text-[11px] text-slate-500">Alasan</p><p>{reason}</p></div>
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
            <b>Apa yang terjadi berikutnya:</b> {approvers} menyetujui, lalu Admin SDM memberi persetujuan payroll. Anda bisa membatalkan selama belum disetujui payroll.
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button type="button" className={BTN_GHOST} onClick={() => setReview(false)} disabled={pending}>← Ubah lagi</button>
            <button type="button" className={BTN_PRIMARY} onClick={() => save(true)} disabled={pending}>{pending ? "Mengajukan…" : "Ajukan sekarang"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Step n={1} title="Kapan" hint="Bisa tanggal yang sudah lewat atau yang akan datang">
        <DatePick value={workDate} onChange={setWorkDate} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600">Dihitung dalam</span>
          <Switch value={unit} onChange={setUnit} options={[{ value: "HOURS", label: "Jam" }, { value: "WORKDAYS", label: "Hari kerja" }]} />
        </div>
      </Step>

      <Step n={2} title="Siapa saja" hint="Pilih beberapa orang sekaligus">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau NIP" aria-label="Cari karyawan" className={FIELD} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip on={section === null} onClick={() => setSection(null)}>Semua</Chip>
              {sections.map((s) => (
                <Chip key={s} on={section === s} onClick={() => setSection(s)}>{s}</Chip>
              ))}
            </div>
            {lastTeam.length > 0 && (
              <div className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                <b>Dipakai terakhir:</b> {lastTeam.length} orang <button type="button" onClick={useLastTeam} className="ml-1 font-semibold underline">Pakai lagi</button>
              </div>
            )}
            <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {visible.map((e) => {
                const on = !!rows[e.id];
                return (
                  <button key={e.id} type="button" onClick={() => toggle(e.id)} aria-pressed={on} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${on ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>{on ? "✓" : ""}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{e.name}</span>
                      <span className="block text-[11px] text-slate-500">{[e.section, e.group].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                );
              })}
              {visible.length === 0 && <p className="py-3 text-center text-xs text-slate-400">Tidak ada yang cocok.</p>}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-700">{unit === "HOURS" ? "Jam kerjanya" : "Jumlah hari kerjanya"}</p>
            {unit === "HOURS" && (
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-600">Samakan semua:</span>
                  <input value={allStart} onChange={(e) => setAllStart(e.target.value)} placeholder="16.00" aria-label="Jam mulai untuk semua" className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm tabular-nums" />
                  <span className="text-slate-400">sampai</span>
                  <input value={allEnd} onChange={(e) => setAllEnd(e.target.value)} placeholder="20.00" aria-label="Jam selesai untuk semua" className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm tabular-nums" />
                  <button type="button" onClick={applyToAll} disabled={selectedIds.length === 0} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50">Terapkan</button>
                </div>
              </div>
            )}
            {selectedIds.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">Pilih karyawan di sebelah kiri. Mereka muncul di sini.</p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Karyawan</th>
                      {unit === "HOURS" && <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mulai</th>}
                      {unit === "HOURS" && <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selesai</th>}
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">{unit === "HOURS" ? "Lama (jam)" : "Hari"}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedIds.map((id) => {
                      const r = rows[id];
                      const m = extraWorkAmountProblem(unit, parseAmount(r.amount));
                      return (
                        <tr key={id}>
                          <td className="px-3 py-2 font-medium">{byId.get(id)?.name}</td>
                          {unit === "HOURS" && (
                            <td className="px-3 py-2"><input value={r.start} onChange={(e) => setRow(id, { start: e.target.value })} placeholder="16.00" aria-label={`Mulai ${byId.get(id)?.name}`} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums" /></td>
                          )}
                          {unit === "HOURS" && (
                            <td className="px-3 py-2"><input value={r.end} onChange={(e) => setRow(id, { end: e.target.value })} placeholder="20.00" aria-label={`Selesai ${byId.get(id)?.name}`} className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums" /></td>
                          )}
                          <td className="px-3 py-2">
                            <input value={r.amount} onChange={(e) => setRow(id, { amount: e.target.value })} aria-label={`Lama ${byId.get(id)?.name}`} className={`w-16 rounded-lg border px-2 py-1 text-sm font-semibold tabular-nums ${m && r.amount ? "border-rose-400" : "border-slate-300"}`} />
                          </td>
                          <td className="px-3 py-2 text-xs"><button type="button" onClick={() => toggle(id)} className="text-rose-600 hover:underline">Hapus</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-slate-400">
              {unit === "HOURS" ? "Lama dihitung dari jam mulai dan selesai. Bisa juga diketik langsung (minimal 1 jam, boleh pecahan seperti 1,5)." : "Isi jumlah hari kerja per orang (boleh pecahan seperti 0,5)."} Admin SDM yang menetapkan angka akhir.
            </p>
          </div>
        </div>
      </Step>

      <Step n={3} title="Alasannya" hint="Wajib diisi. Pilih yang paling dekat, lalu tambahkan keterangan bila perlu">
        <ReasonPick choices={REASONS} value={reason} onChange={setReason} />
      </Step>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 shadow-lg">
        <div>
          <p className="text-sm font-semibold text-slate-900">{selectedIds.length} karyawan · total {formatAmount(total, unit)}</p>
          <p className="text-xs text-slate-500">{problem ?? `Setelah diajukan, formulir menunggu ${approvers}`}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={BTN_GHOST} onClick={() => save(false)} disabled={pending || !workDate}>Simpan draf</button>
          <button type="button" className={BTN_PRIMARY} onClick={() => { setError(null); setReview(true); }} disabled={pending || !!problem}>Periksa dan ajukan</button>
        </div>
      </div>
    </div>
  );
}
