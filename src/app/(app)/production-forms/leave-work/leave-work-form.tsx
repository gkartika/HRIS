"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLeaveWorkAction } from "../actions";
import { formatClock, leaveTimesProblem, parseClock } from "@/lib/production-forms";
import type { ProductionEmployee } from "@/lib/production-forms-service";
import { BTN_GHOST, BTN_PRIMARY, Chip, DatePick, EmployeeSelect, ReasonPick, Step, wibIso } from "../ui";

export interface LeaveWorkInitial {
  id: string | null;
  employeeId: string;
  workDate: string;
  leaveTime: string;
  returnTime: string;
  reason: string;
}

const LEAVE_CHOICES = ["10.00", "10.30", "12.00", "14.00"];
const BACK_CHOICES = ["12.00", "13.00", "14.00"];
const REASONS = ["Urusan keluarga", "Berobat", "Mengurus dokumen"];

// Izin meninggalkan pekerjaan: who, when, from what time to what time, why. The length is worked out for the reader.
export function LeaveWorkForm({ employees, initial, approvers }: { employees: ProductionEmployee[]; initial: LeaveWorkInitial; approvers: string }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [employeeId, setEmployeeId] = useState(initial.employeeId);
  const [workDate, setWorkDate] = useState(initial.workDate || wibIso(0));
  const [leaveTime, setLeaveTime] = useState(initial.leaveTime);
  const [returnTime, setReturnTime] = useState(initial.returnTime);
  const [noReturn, setNoReturn] = useState(initial.id !== null && initial.returnTime === "");
  const [reason, setReason] = useState(initial.reason);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = noReturn ? null : returnTime;
  const timeProblem = leaveTime ? leaveTimesProblem(leaveTime, back) : null;
  const minutes = parseClock(leaveTime) !== null && back && parseClock(back) !== null ? parseClock(back)! - parseClock(leaveTime)! : null;
  const length = minutes !== null && minutes > 0 ? `${String(Math.round((minutes / 60) * 100) / 100).replace(".", ",")} jam` : null;
  const employee = employees.find((e) => e.id === employeeId);
  const problem = !employeeId
    ? "Pilih karyawannya."
    : !workDate
      ? "Pilih tanggalnya."
      : !leaveTime
        ? "Pilih atau isi jam keluar."
        : (timeProblem ?? (!noReturn && !returnTime ? "Isi jam kembali, atau pilih tidak kembali hari ini." : reason.trim().length < 3 ? "Alasan wajib diisi." : null));

  function save(submit: boolean) {
    setError(null);
    run(async () => {
      const res = await saveLeaveWorkAction(
        { employeeId, workDate, leaveTime: leaveTime.trim().replace(":", "."), returnTime: back ? back.trim().replace(":", ".") : null, reason },
        initial.id,
        submit
      );
      if (res.error) setError(res.error);
      else if (res.href) router.push(res.href);
    });
  }

  if (review) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Form Izin Meninggalkan Pekerjaan</p>
        <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><p className="text-[11px] text-slate-500">Karyawan</p><p className="font-medium">{employee?.name}</p></div>
          <div><p className="text-[11px] text-slate-500">Tanggal</p><p className="font-medium">{workDate}</p></div>
          <div><p className="text-[11px] text-slate-500">Keluar</p><p className="font-medium">{formatClock(parseClock(leaveTime) ?? 0)}</p></div>
          <div><p className="text-[11px] text-slate-500">Kembali</p><p className="font-medium">{back ? formatClock(parseClock(back) ?? 0) : "Tidak kembali hari itu"}</p></div>
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><p className="text-[11px] text-slate-500">Alasan</p><p>{reason}</p></div>
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
          <b>Apa yang terjadi berikutnya:</b> {approvers} menyetujui. Admin SDM lalu memutuskan dihitung setengah hari atau satu hari penuh.
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button type="button" className={BTN_GHOST} onClick={() => setReview(false)} disabled={pending}>← Ubah lagi</button>
          <button type="button" className={BTN_PRIMARY} onClick={() => save(true)} disabled={pending}>{pending ? "Mengajukan…" : "Ajukan sekarang"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Step n={1} title="Siapa dan kapan">
            <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} />
            <div className="mt-3"><DatePick value={workDate} onChange={setWorkDate} /></div>
          </Step>
          <Step n={2} title="Jam berapa">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-14 text-sm text-slate-600">Keluar</span>
              {LEAVE_CHOICES.map((c) => <Chip key={c} on={leaveTime === c} onClick={() => setLeaveTime(c)}>{c}</Chip>)}
              <input value={LEAVE_CHOICES.includes(leaveTime) ? "" : leaveTime} onChange={(e) => setLeaveTime(e.target.value)} placeholder="jam lain" aria-label="Jam keluar lain" className="w-24 rounded-lg border border-slate-300 px-2.5 py-1 text-sm" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="w-14 text-sm text-slate-600">Kembali</span>
              {BACK_CHOICES.map((c) => <Chip key={c} on={!noReturn && returnTime === c} onClick={() => { setNoReturn(false); setReturnTime(c); }}>{c}</Chip>)}
              <input value={BACK_CHOICES.includes(returnTime) ? "" : returnTime} onChange={(e) => { setNoReturn(false); setReturnTime(e.target.value); }} placeholder="jam lain" aria-label="Jam kembali lain" className="w-24 rounded-lg border border-slate-300 px-2.5 py-1 text-sm" />
              <Chip on={noReturn} onClick={() => setNoReturn((v) => !v)}>Tidak kembali hari ini</Chip>
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              {timeProblem ? <span className="text-rose-700">{timeProblem}</span> : length ? <>Lama izin: <b>{length}</b></> : noReturn ? "Tidak kembali hari itu." : "Pilih jam keluar dan kembali."}
            </p>
          </Step>
        </div>
        <div className="space-y-4">
          <Step n={3} title="Alasannya" hint="Wajib diisi">
            <ReasonPick choices={REASONS} value={reason} onChange={setReason} />
          </Step>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
            <b>Berikutnya:</b> {approvers} menyetujui. Admin SDM lalu memutuskan dihitung setengah hari atau penuh.
          </div>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 shadow-lg">
        <p className="text-xs text-slate-500">{problem ?? `Siap diajukan ke ${approvers}`}</p>
        <div className="flex gap-2">
          <button type="button" className={BTN_GHOST} onClick={() => save(false)} disabled={pending || !employeeId || !workDate}>Simpan draf</button>
          <button type="button" className={BTN_PRIMARY} onClick={() => { setError(null); setReview(true); }} disabled={pending || !!problem}>Periksa dan ajukan</button>
        </div>
      </div>
    </div>
  );
}
