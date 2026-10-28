"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import {
  addRequestSeatsAction,
  holdRecruitmentRequestAction,
  reduceRecruitmentHeadcountAction,
  resumeRecruitmentRequestAction,
  setRecruitmentRequestJobAction,
} from "../request-changes-actions";
import { vacantSeatShortfall } from "@/lib/recruitment";
import { headcountFloor } from "@/lib/recruitment-request-changes";
import { t } from "@/lib/i18n/id";

const FIELD = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const LEVELS = ["STAFF_OPERATOR", "HARIAN_LEPAS", "SUPERVISOR", "SECTION_HEAD", "DEPARTMENT_HEAD"] as const;

export interface JobChoice {
  id: string;
  label: string;
  /** Vacant seats of this Jabatan in the request's Department. */
  vacant: number;
}

type FormAction = (previous: string | undefined, formData: FormData) => Promise<string | undefined>;

// Runs the action and calls onDone when it succeeded (no error text came back), so the small form can close.
function withDone(action: FormAction, onDone?: () => void): FormAction {
  return async (previous, formData) => {
    const error = await action(previous, formData);
    if (!error) onDone?.();
    return error;
  };
}

// Like <form action>, but React does not wipe the fields afterwards: when the server answers with an error the
// person keeps what they typed and chose.
export function useKeptForm(action: FormAction) {
  const [error, run, pending] = useActionState(action, undefined);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => run(data));
  };
  return [error, submit, pending] as const;
}

function ErrorLine({ error }: { error: string | undefined }) {
  return error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null;
}

// Extra seats for the saved Jabatan, reporting to the requester's seat. A separate form so it never nests
// inside the Jabatan form.
function SeatsAdder({ requestId, vacant, headcount }: { requestId: string; vacant: number; headcount: number }) {
  const shortfall = vacantSeatShortfall(headcount, vacant);
  const [error, formAction, pending] = useActionState(addRequestSeatsAction.bind(null, requestId), undefined);
  return (
    <form action={formAction} className="mt-1 flex flex-wrap items-center gap-2">
      <input type="hidden" name="count" value={Math.max(1, shortfall)} />
      <button type="submit" disabled={pending} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60">
        {pending ? t("common.loading") : `+ Tambah ${Math.max(1, shortfall)} kursi`}
      </button>
      <span className="text-xs text-slate-500">Kursi baru melapor ke posisi pengaju, kodenya otomatis.</span>
      <ErrorLine error={error} />
    </form>
  );
}

// Pick the standard Jabatan (or create it) and the level. Before approval this is the normal step; after approval
// it is a change and asks for a reason.
export function JobForm({
  requestId,
  jobs,
  currentJobId,
  currentLevel,
  requestedText,
  headcount,
  needsReason,
  submitLabel,
  onDone,
}: {
  requestId: string;
  jobs: JobChoice[];
  currentJobId: string | null;
  currentLevel: string | null;
  requestedText: string | null;
  headcount: number;
  needsReason: boolean;
  submitLabel: string;
  onDone?: () => void;
}) {
  const [error, submit, pending] = useKeptForm(withDone(setRecruitmentRequestJobAction.bind(null, requestId), onDone));
  const [choice, setChoice] = useState(currentJobId ?? "");
  const selected = jobs.find((j) => j.id === choice);
  const askReason = needsReason && !!currentJobId;

  return (
    <div>
      <form onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Jabatan</label>
            <select name="jobId" required value={choice} onChange={(e) => setChoice(e.target.value)} className={FIELD}>
              <option value="">— Pilih —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
              <option value="__new__">+ Buat jabatan baru</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Level</label>
            <select name="level" required defaultValue={currentLevel ?? ""} className={FIELD}>
              <option value="">— Pilih —</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`requestedJobLevel.${l}`)}
                </option>
              ))}
            </select>
          </div>
          {choice === "__new__" && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Nama jabatan baru</label>
              <input name="newJobTitle" type="text" required defaultValue={requestedText ?? ""} maxLength={120} className={FIELD} />
              <p className="mt-1 text-xs text-slate-500">Terisi dari tulisan pengaju. Kode dibuat otomatis, jabatan langsung masuk ke daftar Jabatan.</p>
            </div>
          )}
          {askReason && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Alasan perubahan (wajib, masuk riwayat)</label>
              <textarea name="reason" rows={2} className={FIELD} />
            </div>
          )}
        </div>
        <ErrorLine error={error} />
        <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? t("common.loading") : submitLabel}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {choice === "__new__" ? (
          <span>Jabatan baru belum punya kursi kosong. Simpan jabatannya dulu, lalu tambah kursi.</span>
        ) : selected ? (
          <span>
            Kursi kosong: <b>{selected.vacant}</b> dari {headcount} dibutuhkan
          </span>
        ) : (
          <span>Pilih jabatan untuk melihat kursi kosongnya.</span>
        )}
      </div>
      {selected && selected.id === currentJobId && <SeatsAdder requestId={requestId} vacant={selected.vacant} headcount={headcount} />}
    </div>
  );
}

function HoldForm({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const [error, submit, pending] = useKeptForm(withDone(holdRecruitmentRequestAction.bind(null, requestId), onDone));
  return (
    <form onSubmit={submit} className="rounded-lg bg-slate-50 p-3 text-sm">
      <label className="mb-1 block text-xs text-slate-500">Alasan menahan</label>
      <textarea name="reason" rows={2} required className={FIELD} />
      <p className="mt-2 text-xs text-slate-500">
        Lowongan publik berhenti menerima pelamar, pelamar yang ada tetap tersimpan. Tidak lanjut sendiri: tekan <b>Lanjutkan</b>.
      </p>
      <ErrorLine error={error} />
      <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? t("common.loading") : "Tahan"}
      </button>
    </form>
  );
}

function ReduceForm({ requestId, headcount, floor, onDone }: { requestId: string; headcount: number; floor: number; onDone: () => void }) {
  const [error, submit, pending] = useKeptForm(withDone(reduceRecruitmentHeadcountAction.bind(null, requestId), onDone));
  const [value, setValue] = useState(String(Math.max(floor, headcount - 1)));
  return (
    <form onSubmit={submit} className="rounded-lg bg-slate-50 p-3 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Jumlah baru (paling sedikit {floor})</label>
          <input name="newCount" type="number" required min={floor} max={headcount - 1} value={value} onChange={(e) => setValue(e.target.value)} className={`${FIELD} w-28`} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Alasan</label>
          <textarea name="reason" rows={2} required className={FIELD} />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Paling sedikit sebanyak yang sudah terisi atau sedang dimutasi. Tidak bisa menambah: buat permintaan baru. Berlaku langsung tanpa persetujuan ulang.
      </p>
      <ErrorLine error={error} />
      <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {pending ? t("common.loading") : `Kurangi jadi ${value || "…"}`}
      </button>
    </form>
  );
}

export function ResumeButton({ requestId }: { requestId: string }) {
  const [error, formAction, pending] = useActionState(resumeRecruitmentRequestAction.bind(null, requestId), undefined);
  return (
    <form action={formAction} className="mt-2">
      <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
        {pending ? t("common.loading") : "Lanjutkan permintaan"}
      </button>
      <ErrorLine error={error} />
    </form>
  );
}

type Mode = "hold" | "reduce" | "job" | null;

// After approval: Tahan, Kurangi jumlah and (Admin Rekrutmen only) Ubah jabatan. One small form
// at a time. While the request is held only Lanjutkan, Kurangi and Ubah jabatan remain.
export function ManagePanel({
  requestId,
  headcount,
  filled,
  underway,
  held,
  jobForm,
}: {
  requestId: string;
  headcount: number;
  filled: number;
  underway: number;
  held: boolean;
  jobForm: (Parameters<typeof JobForm>[0]) | null;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const floor = headcountFloor(filled, underway);
  const canReduce = headcount > floor;
  const button = (m: Exclude<Mode, null>, label: string, enabled = true) => (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => setMode(mode === m ? null : m)}
      className={`rounded-lg border px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
        mode === m ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-900">Kelola permintaan</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!held && button("hold", "Tahan")}
        {button("reduce", "Kurangi jumlah", canReduce)}
        {jobForm && button("job", "Ubah jabatan")}
      </div>
      {!canReduce && <p className="mt-2 text-xs text-slate-500">Jumlah tidak bisa dikurangi lagi: {filled} sudah ditempatkan{underway > 0 ? `, ${underway} Mutasi berjalan` : ""}.</p>}
      <div className="mt-3">
        {mode === "hold" && <HoldForm requestId={requestId} onDone={() => setMode(null)} />}
        {mode === "reduce" && canReduce && <ReduceForm requestId={requestId} headcount={headcount} floor={floor} onDone={() => setMode(null)} />}
        {mode === "job" && jobForm && (
          <div className="rounded-lg bg-slate-50 p-3">
            <JobForm key={jobForm.currentJobId ?? "none"} {...jobForm} onDone={() => setMode(null)} />
            <p className="mt-2 text-xs text-slate-500">Tidak bisa kalau sudah ada yang ditempatkan atau Mutasi masih berjalan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
