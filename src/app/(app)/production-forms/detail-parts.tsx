"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelFormAction,
  decideLeaveWorkAction,
  handOverDisciplineAction,
  leaderDecideAction,
  payrollDecideAction,
  submitExistingAction,
  type SaveResult,
} from "./actions";
import { canCancel, canEdit, FORM_PATH, formatAmount } from "@/lib/production-forms";
import type { LeaveWorkDecision, ProductionFormKind, ProductionFormStatus } from "@/generated/prisma/enums";
import { BTN_GHOST, BTN_PRIMARY, FIELD, wibIso } from "./ui";

// The buttons on a form's page. Which ones show depends on who is looking and where the form is (decided by the page);
// every action is checked again on the server.

function useAction() {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  function go(fn: () => Promise<SaveResult>, after?: (r: SaveResult) => void) {
    setError(null);
    setNotice(null);
    run(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        if (r.warning) setNotice(r.warning);
        after?.(r);
        router.refresh();
      }
    });
  }
  return { pending, error, notice, go, setError };
}

const Msg = ({ error, notice }: { error: string | null; notice: string | null }) => (
  <>
    {error && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    {notice && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
  </>
);

// Admin Produksi: send a saved draft, change it, withdraw it, print it, copy it.
export function ClerkActions({ kind, id, status, canCopy }: { kind: ProductionFormKind; id: string; status: ProductionFormStatus; canCopy: boolean }) {
  const { pending, error, notice, go } = useAction();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const path = FORM_PATH[kind];
  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit(status) && (
          <>
            <button type="button" className={BTN_PRIMARY} disabled={pending} onClick={() => go(() => submitExistingAction(kind, id))}>Ajukan sekarang</button>
            <Link href={`/production-forms/${path}/${id}/edit`} className={BTN_GHOST}>Ubah</Link>
          </>
        )}
        <button type="button" className={BTN_GHOST} onClick={() => window.print()}>Cetak formulir</button>
        {canCopy && <Link href={`/production-forms/${path}/new?copy=${id}`} className={BTN_GHOST}>Salin jadi formulir baru</Link>}
        {canCancel(status) && !asking && <button type="button" className="rounded-lg border border-rose-200 bg-white px-5 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50" onClick={() => setAsking(true)}>Batalkan formulir</button>}
      </div>
      {asking && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-700">Formulir yang dibatalkan tidak diproses lagi. Alasan (opsional):</p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Alasan pembatalan" className={FIELD} />
          <div className="flex gap-2">
            <button type="button" className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={pending} onClick={() => go(() => cancelFormAction(kind, id, reason), () => setAsking(false))}>Ya, batalkan</button>
            <button type="button" className={BTN_GHOST} onClick={() => setAsking(false)}>Tidak jadi</button>
          </div>
        </div>
      )}
      <Msg error={error} notice={notice} />
    </div>
  );
}

// 3A or 3B: approve, return for correction, or reject.
export function LeaderPanel({ kind, id }: { kind: ProductionFormKind; id: string }) {
  const { pending, error, notice, go } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <p className="text-sm font-semibold text-slate-900">Keputusan Anda</p>
      <p className="mb-2 text-xs text-slate-500">3A dan 3B sama-sama melihat formulir ini. Yang pertama memutuskan, riwayat mencatat siapa.</p>
      <label className="mb-1 block text-xs text-slate-500" htmlFor="leader-note">Catatan (wajib bila menolak atau mengembalikan)</label>
      <textarea id="leader-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={FIELD} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={pending} onClick={() => go(() => leaderDecideAction(kind, id, "APPROVE", note))}>Setujui</button>
        <button type="button" className={BTN_GHOST} disabled={pending} onClick={() => go(() => leaderDecideAction(kind, id, "RETURN", note))}>Kembalikan</button>
        <button type="button" className="rounded-lg border border-rose-200 bg-white px-5 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={pending} onClick={() => go(() => leaderDecideAction(kind, id, "REJECT", note))}>Tolak</button>
      </div>
      <Msg error={error} notice={notice} />
    </div>
  );
}

// Admin SDM, Tambahan jam kerja: the final amount per person, then approve for payroll.
export function PayrollPanel({ id, unit, lines }: { id: string; unit: "HOURS" | "WORKDAYS"; lines: { id: string; name: string; requested: number }[] }) {
  const { pending, error, notice, go } = useAction();
  const [finals, setFinals] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.id, String(l.requested).replace(".", ",")])));
  const [note, setNote] = useState("");
  const parse = (s: string) => {
    const n = Number(s.trim().replace(",", "."));
    return s.trim() !== "" && Number.isFinite(n) ? n : null;
  };
  const changed = lines.filter((l) => parse(finals[l.id]) !== l.requested);
  function payload(): Record<string, number | null> {
    return Object.fromEntries(lines.map((l) => [l.id, parse(finals[l.id])]));
  }
  return (
    <div className="print:hidden rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Persetujuan payroll</p>
      <p className="mb-3 text-xs text-slate-500">Anda yang menetapkan angka akhir. Isi 0 bila seseorang tidak dihitung.</p>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Karyawan</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Diajukan</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Jumlah final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => {
              const diff = parse(finals[l.id]) !== l.requested;
              return (
                <tr key={l.id}>
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 tabular-nums">{formatAmount(l.requested, unit)}</td>
                  <td className="px-3 py-2">
                    <input value={finals[l.id]} onChange={(e) => setFinals((f) => ({ ...f, [l.id]: e.target.value }))} aria-label={`Jumlah final ${l.name}`} className={`w-20 rounded-lg border px-2 py-1 text-sm tabular-nums ${diff ? "border-amber-300 bg-amber-50" : "border-slate-300"}`} />
                    {diff && <span className="ml-2 text-xs text-amber-700">diubah</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="mb-1 mt-3 block text-xs text-slate-500" htmlFor="payroll-note">Catatan {changed.length > 0 ? "(wajib karena ada angka diubah)" : "(wajib bila menolak atau mengembalikan)"}</label>
      <textarea id="payroll-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={FIELD} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={BTN_PRIMARY} disabled={pending} onClick={() => go(() => payrollDecideAction(id, "APPROVE", payload(), note))}>Setujui untuk payroll</button>
        <button type="button" className={BTN_GHOST} disabled={pending} onClick={() => go(() => payrollDecideAction(id, "RETURN", {}, note))}>Kembalikan ke Production Department</button>
        <button type="button" className="rounded-lg border border-rose-200 bg-white px-5 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={pending} onClick={() => go(() => payrollDecideAction(id, "REJECT", {}, note))}>Tolak</button>
      </div>
      <Msg error={error} notice={notice} />
    </div>
  );
}

// Admin SDM, Izin: half a day or the full day.
export function LeaveDecisionPanel({ id, current }: { id: string; current: LeaveWorkDecision | null }) {
  const { pending, error, notice, go } = useAction();
  const [choice, setChoice] = useState<LeaveWorkDecision>(current ?? "HALF_DAY");
  const [note, setNote] = useState("");
  const option = (value: LeaveWorkDecision, title: string, sub: string) => (
    <button type="button" onClick={() => setChoice(value)} aria-pressed={choice === value} className={`w-full rounded-lg border-2 p-3 text-left ${choice === value ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200"}`}>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </button>
  );
  return (
    <div className="print:hidden rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Keputusan Admin SDM</p>
      <div className="mt-3 space-y-2">
        {option("HALF_DAY", "Dihitung setengah hari", "Kode absensi Setengah Hari (SH): minus 1 poin, jam kerja dihitung 0,5")}
        {option("FULL_DAY", "Tetap satu hari penuh", "Kode absensi Izin (I): 0 poin, hari hilang dihitung")}
      </div>
      <label className="mb-1 mt-3 block text-xs text-slate-500" htmlFor="leave-note">Catatan (opsional)</label>
      <textarea id="leave-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={FIELD} />
      <div className="mt-3">
        <button type="button" className={BTN_PRIMARY} disabled={pending} onClick={() => go(() => decideLeaveWorkAction(id, choice, note))}>{current ? "Ubah keputusan" : "Simpan keputusan"}</button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Keputusan langsung menentukan kode absensi hari itu (tanpa rekonsiliasi) dan masuk ke Excel payroll. Bisa diubah selama periode payroll hari itu belum ditutup.</p>
      <Msg error={error} notice={notice} />
    </div>
  );
}

// Admin SDM, Surat Peringatan: handed to the employee on this date.
export function HandoverPanel({ id }: { id: string }) {
  const { pending, error, notice, go } = useAction();
  const [date, setDate] = useState(wibIso(0));
  return (
    <div className="print:hidden rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Penyerahan ke karyawan</p>
      <p className="mb-3 text-xs text-slate-500">Tanda tangan karyawan tetap di kertas. SP baru berlaku, 6 bulan, sejak tanggal diserahkan.</p>
      <label className="mb-1 block text-xs text-slate-500" htmlFor="handover-date">Tanggal diserahkan ke karyawan</label>
      <input id="handover-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <div className="mt-3">
        <button type="button" className={BTN_PRIMARY} disabled={pending || !date} onClick={() => go(() => handOverDisciplineAction(id, date))}>Catat sudah diserahkan</button>
      </div>
      <Msg error={error} notice={notice} />
    </div>
  );
}
