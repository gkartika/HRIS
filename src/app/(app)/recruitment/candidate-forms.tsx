"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { SignaturePad } from "@/components/signature-pad";
import { DocumentFileInput } from "@/components/document-file-input";
import {
  decideCandidateAction,
  recordOfferResponseAction,
  saveHrNotesAction,
  scheduleInterviewAction,
  sendOfferAction,
  setOpenForAction,
  setRequestTestsAction,
  regenerateAccessCodeAction,
  setReviewersAction,
  uploadOfferAction,
  purgeOldCandidatesAction,
  type ScheduleResult,
  type SendOfferResult,
} from "./candidate-actions";
import { OPEN_FOR_LABEL } from "@/lib/recruitment-candidates";
import type { RecruitmentInterviewDecision, RecruitmentOpenFor } from "@/generated/prisma/enums";

const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const label = "mb-1 block text-xs text-slate-500";
const primary = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60";
const ghost = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";

export interface StaffOption {
  id: string;
  fullLegalName: string;
  employeeNumber: string;
  jobTitle: string | null;
}

export function CopyButton({ text, labelText = "Salin" }: { text: string; labelText?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={ghost}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Salin tautan ini:", text);
        }
      }}
    >
      {done ? "Tersalin" : labelText}
    </button>
  );
}

// ---------- the vacancy: which tests, who may apply, access code ----------

// Pick the tests for ONE vacancy. Starts from the job title's tests (Pengaturan Rekrutmen); once saved,
// the vacancy keeps its own pick. Cultural Fit is always required.
export function RequestTestsControl({
  requestId,
  columns,
  jobDefaultKeys,
  customized,
  selectedKeys,
}: {
  requestId: string;
  columns: { key: string; label: string; ids: string[] }[];
  jobDefaultKeys: string[];
  customized: boolean;
  selectedKeys: string[];
}) {
  const [pending, run] = useTransition();
  const [picked, setPicked] = useState<string[]>(selectedKeys);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = picked.length !== selectedKeys.length || picked.some((k) => !selectedKeys.includes(k));

  function save(keys: string[] | null) {
    setError(null);
    setSaved(false);
    const ids = keys === null ? null : columns.filter((c) => keys.includes(c.key)).flatMap((c) => c.ids);
    run(async () => {
      const message = await setRequestTestsAction(requestId, ids);
      if (message) setError(message);
      else {
        setSaved(true);
        if (keys === null) setPicked(jobDefaultKeys);
      }
    });
  }

  return (
    <div>
      <p className={label}>Tes untuk lowongan ini</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked disabled aria-label="Cultural Fit (wajib)" /> Cultural Fit <span className="text-[11px] text-slate-400">(wajib)</span>
        </span>
        {columns.map((c) => (
          <label key={c.key} className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={picked.includes(c.key)}
              disabled={pending}
              onChange={(e) => {
                setSaved(false);
                setPicked((p) => (e.target.checked ? [...p, c.key] : p.filter((k) => k !== c.key)));
              }}
            />
            {c.label}
            {c.ids.length > 1 && <span className="text-[11px] text-slate-400">({c.ids.length} set bergantian)</span>}
          </label>
        ))}
        {columns.length === 0 && <span className="text-xs text-slate-400">Belum ada tes tambahan aktif (buat di Pengaturan Rekrutmen).</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={pending || (!changed && customized)} onClick={() => save(picked)}>
          {pending ? "Menyimpan..." : "Simpan pilihan tes"}
        </button>
        {customized && (
          <button type="button" className={ghost} disabled={pending} onClick={() => save(null)}>
            Kembali ke tes bawaan jabatan
          </button>
        )}
        {saved && <span className="text-xs text-emerald-700">Tersimpan.</span>}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {customized ? "Lowongan ini memakai pilihan sendiri." : "Saat ini mengikuti tes bawaan jabatan (Pengaturan Rekrutmen); simpan untuk menetapkan pilihan khusus lowongan ini."}{" "}
        Pelamar yang sudah masuk tetap dengan tes yang sudah mereka dapat.
      </p>
      {error && <p className="mt-1 text-xs text-rose-600" role="alert">{error}</p>}
    </div>
  );
}

export function OpenForControl({
  requestId,
  openFor,
  accessCode,
  publicUrl,
}: {
  requestId: string;
  openFor: RecruitmentOpenFor;
  accessCode: string | null;
  publicUrl: string;
}) {
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const external = openFor === "EXTERNAL" || openFor === "BOTH";

  function change(next: RecruitmentOpenFor) {
    setError(null);
    run(async () => {
      const message = await setOpenForAction(requestId, next);
      if (message) setError(message);
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className={label}>Dibuka untuk</p>
        <div className="flex flex-wrap gap-2">
          {(["NONE", "EXTERNAL", "INTERNAL", "BOTH"] as RecruitmentOpenFor[]).map((o) => (
            <button
              key={o}
              type="button"
              disabled={pending}
              onClick={() => change(o)}
              aria-pressed={openFor === o}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${openFor === o ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {OPEN_FOR_LABEL[o]}
            </button>
          ))}
        </div>
      </div>
      {external && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className={label}>Kode akses (tulis di iklan lowongan)</p>
            <div className="flex items-center gap-2">
              <code className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900">{accessCode ?? "—"}</code>
              {accessCode && <CopyButton text={accessCode} />}
              <ConfirmButton
                label="Buat kode baru"
                confirmLabel="Ya, ganti"
                pending={pending}
                onConfirm={() =>
                  run(async () => {
                    const message = await regenerateAccessCodeAction(requestId);
                    if (message) setError(message);
                  })
                }
                className="text-xs text-indigo-600 hover:underline"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Kode lama berhenti berlaku. Pelamar yang sudah masuk tidak terpengaruh.</p>
          </div>
          <div>
            <p className={label}>Halaman lowongan untuk pelamar</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 truncate rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-900">{publicUrl}</code>
              <CopyButton text={publicUrl} />
            </div>
          </div>
        </div>
      )}
      {external && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Halaman publik menampilkan jabatan, departemen, shift, pendidikan, pengalaman, deskripsi tugas, dan kriteria khusus dari permintaan ini. Pastikan teksnya aman dibaca orang luar.
        </p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ---------- essay reviewers ----------

export function ReviewerPicker({
  candidateId,
  testId,
  staff,
  selectedIds,
}: {
  candidateId: string;
  testId: string;
  staff: StaffOption[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState("");
  const [pending, run] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const shown = staff.filter((s) => `${s.fullLegalName} ${s.employeeNumber} ${s.jobTitle ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  function save() {
    run(async () => {
      const error = await setReviewersAction(candidateId, testId, selected);
      setMessage(error ? { text: error, ok: false } : { text: "Reviewer tersimpan dan diberi tahu lewat email.", ok: true });
      if (!error) router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-900">Siapa yang boleh membaca dan menilai jawaban ini</p>
      <p className="text-xs text-slate-500">Hanya orang yang dipilih yang melihat jawaban. Bisa siapa saja yang punya akun login.</p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama atau NIP" aria-label="Cari reviewer" className={`${input} mt-2`} />
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {shown.map((s) => (
          <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-white">
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id)))}
            />
            <span className="text-slate-900">{s.fullLegalName}</span>
            <span className="text-xs text-slate-400">{s.jobTitle ?? s.employeeNumber}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Tidak ada yang cocok.</p>}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={primary} disabled={pending || selected.length === 0} onClick={save}>
          {pending ? "Menyimpan..." : "Simpan reviewer"}
        </button>
        {message && <span className={`text-xs ${message.ok ? "text-emerald-700" : "text-rose-600"}`}>{message.text}</span>}
      </div>
    </div>
  );
}

// ---------- interview ----------

export interface InterviewDefaults {
  date: string;
  time: string;
  mode: "OFFLINE" | "ONLINE";
  location: string;
  employeeIds: string[];
}

export function ScheduleInterviewForm({
  candidateId,
  staff,
  maxInterviewers,
  defaultInterviewers,
  existing,
}: {
  candidateId: string;
  staff: StaffOption[];
  maxInterviewers: number;
  defaultInterviewers: number;
  existing: InterviewDefaults | null;
}) {
  const router = useRouter();
  const action = scheduleInterviewAction.bind(null, candidateId);
  const [result, formAction, pending] = useActionState<ScheduleResult | undefined, FormData>(action, undefined);
  const [slots, setSlots] = useState<string[]>(
    existing?.employeeIds.length ? existing.employeeIds : Array.from({ length: Math.min(Math.max(1, defaultInterviewers), maxInterviewers) }, () => "")
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          await formAction(data);
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={label} htmlFor="iv-date">Tanggal</label>
          <input id="iv-date" name="date" type="date" required defaultValue={existing?.date} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="iv-time">Jam (WIB)</label>
          <input id="iv-time" name="time" type="time" required defaultValue={existing?.time ?? "09:00"} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="iv-mode">Bentuk</label>
          <select id="iv-mode" name="mode" defaultValue={existing?.mode ?? "OFFLINE"} className={input}>
            <option value="OFFLINE">Offline (di kantor)</option>
            <option value="ONLINE">Online</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="iv-loc">Lokasi / tautan meeting</label>
          <input id="iv-loc" name="location" required defaultValue={existing?.location} placeholder="Ruang Meeting HR" className={input} />
        </div>
      </div>

      <div>
        <p className={label}>
          Pewawancara (1 sampai {maxInterviewers}, bebas siapa saja, tidak harus atasan)
        </p>
        <div className="space-y-2">
          {slots.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                name="interviewer"
                aria-label={`Pewawancara ${i + 1}`}
                value={value}
                onChange={(e) => setSlots((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))}
                className={input}
              >
                <option value="">— Pilih —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id} disabled={slots.includes(s.id) && value !== s.id}>
                    {s.fullLegalName} ({s.jobTitle ?? s.employeeNumber})
                  </option>
                ))}
              </select>
              {slots.length > 1 && (
                <button type="button" className={ghost} onClick={() => setSlots((cur) => cur.filter((_, j) => j !== i))}>
                  Hapus
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button type="button" className={ghost} disabled={slots.length >= maxInterviewers} onClick={() => setSlots((cur) => [...cur, ""])}>
            + Tambah pewawancara
          </button>
          <span className="text-xs text-slate-400">
            {slots.length >= maxInterviewers ? `Maksimum ${maxInterviewers} (diatur di Pengaturan Rekrutmen)` : `${slots.length} dari ${maxInterviewers}`}
          </span>
        </div>
      </div>

      {result?.error && <p className="text-xs text-rose-600">{result.error}</p>}
      {result && !result.error && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          Jadwal tersimpan.{" "}
          {result.emailedCandidate ? "Email undangan terkirim ke pelamar." : "Email ke pelamar tidak terkirim, kirim lewat WhatsApp."}{" "}
          {result.emailedInterviewers ? `${result.emailedInterviewers} pewawancara diberi tahu lewat email.` : "Pewawancara belum menerima email, beri tahu langsung."}
          {result.whatsappUrl && (
            <div className="mt-2">
              <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${ghost} inline-block bg-white`}>
                Buka WhatsApp
              </a>
            </div>
          )}
        </div>
      )}
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Menyimpan..." : existing ? "Simpan perubahan jadwal" : "Jadwalkan dan kirim undangan"}
      </button>
    </form>
  );
}

export function HrNotesForm({ candidateId, defaults }: { candidateId: string; defaults: { attendance: string; documents: string; process: string } }) {
  const action = saveHrNotesAction.bind(null, candidateId);
  const [error, formAction, pending] = useActionState(action, undefined);
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setSaved(false);
        startTransition(async () => {
          await formAction(data);
          setSaved(true);
        });
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <div>
        <label className={label} htmlFor="hr-att">Kehadiran</label>
        <textarea id="hr-att" name="attendance" rows={3} defaultValue={defaults.attendance} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="hr-doc">Kelengkapan dokumen</label>
        <textarea id="hr-doc" name="documents" rows={3} defaultValue={defaults.documents} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="hr-proc">Catatan proses</label>
        <textarea id="hr-proc" name="process" rows={3} defaultValue={defaults.process} className={input} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className={ghost}>
          {pending ? "Menyimpan..." : "Simpan bagian HR"}
        </button>
        {error && <span className="text-xs text-rose-600">{error}</span>}
        {saved && !error && !pending && <span className="text-xs text-emerald-700">Tersimpan.</span>}
      </div>
    </form>
  );
}

export function DecisionForm({ candidateId, isInternal }: { candidateId: string; isInternal: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  function decide(decision: RecruitmentInterviewDecision) {
    setError(null);
    const data = new FormData();
    data.set("note", note);
    run(async () => {
      const message = await decideCandidateAction(candidateId, decision, undefined, data);
      if (message) setError(message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Keputusan akhir ditetapkan HR Admin sendiri setelah membaca semua penilaian, tidak dihitung dari suara pewawancara.{" "}
        {isInternal ? "Diterima atau Dipertimbangkan melanjutkan ke Perubahan Posisi." : "Diterima atau Dipertimbangkan melanjutkan ke Offering Letter."}
      </p>
      <div>
        <label className={label} htmlFor="decision-note">Catatan (wajib jika Ditolak)</label>
        <textarea id="decision-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => decide("ACCEPTED")} className={primary}>
          Diterima
        </button>
        <button type="button" disabled={pending} onClick={() => decide("CONSIDERED")} className={ghost}>
          Dipertimbangkan
        </button>
        <button type="button" disabled={pending} onClick={() => decide("REJECTED")} className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60">
          Ditolak
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ---------- offering letter ----------

export function OfferUploadForm({ candidateId, replacing }: { candidateId: string; replacing: boolean }) {
  const router = useRouter();
  const action = uploadOfferAction.bind(null, candidateId);
  const [error, formAction, pending] = useActionState(action, undefined);
  const [signature, setSignature] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          await formAction(data);
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <div>
        <label className={label} htmlFor="offer-file">Berkas Offering Letter (PDF, maksimal 4 MB)</label>
        <DocumentFileInput id="offer-file" name="file" accept=".pdf" required className="block w-full text-sm text-slate-700" />
      </div>
      <div>
        <p className={label}>Tanda tangan perusahaan (gambar di layar)</p>
        <SignaturePad name="signature" onChange={setSignature} />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={pending || !signature} className={primary}>
        {pending ? "Menyimpan..." : replacing ? "Ganti offering letter" : "Simpan offering letter"}
      </button>
    </form>
  );
}

export function OfferSendPanel({
  candidateId,
  sentAt,
  hasResponse,
}: {
  candidateId: string;
  sentAt: string | null;
  hasResponse: boolean;
}) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [result, setResult] = useState<SendOfferResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function send() {
    setError(null);
    run(async () => {
      const res = await sendOfferAction(candidateId);
      if (res.error) setError(res.error);
      else {
        setResult(res);
        router.refresh();
      }
    });
  }
  function record(response: "ACCEPTED" | "DECLINED") {
    setError(null);
    run(async () => {
      const message = await recordOfferResponseAction(candidateId, response);
      if (message) setError(message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {!hasResponse && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending} onClick={send} className={primary}>
            {sentAt ? "Kirim ulang (tautan baru)" : "Kirim ke kandidat"}
          </button>
          {sentAt && <span className="text-xs text-slate-500">Terakhir dikirim {sentAt}. Tautan lama berhenti berlaku saat tautan baru dibuat.</span>}
        </div>
      )}
      {result?.url && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {result.emailed ? "Email berisi tautan sudah terkirim ke kandidat." : "Email tidak terkirim. Kirim tautan di bawah lewat WhatsApp."}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 truncate rounded bg-white px-2 py-1 font-mono text-xs">{result.url}</code>
            <CopyButton text={result.url} />
            {result.whatsappUrl && (
              <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${ghost} bg-white`}>
                Buka WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
      {!hasResponse && sentAt && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Kandidat menjawab lewat telepon atau pesan?</span>
          <ConfirmButton label="Catat: menerima" confirmLabel="Ya, kandidat menerima" pending={pending} onConfirm={() => record("ACCEPTED")} className="text-indigo-600 hover:underline" />
          <ConfirmButton label="Catat: menolak" confirmLabel="Ya, kandidat menolak" pending={pending} onConfirm={() => record("DECLINED")} />
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ---------- clean-up of old applicants ----------

export function PurgeButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, run] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ConfirmButton
        label={`Hapus ${count} pelamar lama`}
        confirmLabel="Ya, hapus permanen"
        pending={pending}
        disabled={count === 0}
        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
        onConfirm={() =>
          run(async () => {
            const res = await purgeOldCandidatesAction();
            setMessage(res.error ?? `${res.deleted ?? 0} pelamar dihapus.`);
            router.refresh();
          })
        }
      />
      {message && <span className="text-xs text-slate-600">{message}</span>}
    </div>
  );
}
