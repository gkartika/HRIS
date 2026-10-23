"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TestProtection } from "@/components/test-protection";
import { t } from "@/lib/i18n/id";
import { ESSAY_MAX_CHARS, ESSAY_MIN_CHARS, SCALE_LABELS, formatClock } from "@/lib/recruitment-candidates";
import type { RunnerState } from "@/lib/recruitment-service";
import { saveAnswerAction, startTestAction, submitTestAction, type TestAccess } from "./test-actions";

type Answer = { index?: number; text?: string };

const CONNECTION_LOST = "Koneksi terputus. Periksa internet Anda lalu coba lagi. Jawaban yang sudah tersimpan tidak hilang.";

const btnPrimary = "rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost = "rounded-full border border-[#cfc4d6] bg-white px-5 py-2.5 text-sm font-semibold text-[#4a3e52] hover:bg-[#f4eef5] disabled:cursor-not-allowed disabled:opacity-50";

// The test page for one applicant: the list of tests, every question on one page, a
// countdown that comes from the server's deadline, and answers saved as they are given.
// Copy protection (see TestProtection) is the same for every test and for Tes Situasi Kerja.
export function TestRunner(props: { access: TestAccess; state: RunnerState; serverNowMs: number }) {
  // A new key per test and per status makes each test start with fresh answers.
  const key = props.state.active?.testId ?? props.state.assessment.status[0] + props.state.tests.map((t) => t.status[0]).join("") + props.state.candidate.status;
  return <TestRunnerInner key={key} {...props} />;
}

function TestRunnerInner({ access, state, serverNowMs }: { access: TestAccess; state: RunnerState; serverNowMs: number }) {
  const router = useRouter();
  const active = state.active;
  const [answers, setAnswers] = useState<Record<string, Answer>>(active?.answers ?? {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(serverNowMs);
  const offsetRef = useRef(0);
  const submittedRef = useRef(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const essayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const submitRef = useRef<(auto: boolean) => Promise<void>>(async () => {});
  const deadlineAtMs = active?.deadlineAtMs ?? null;

  // Clock: the browser's clock only supplies the ticking; the zero point is the server's.
  // When the deadline passes, the test is handed in as it stands.
  useEffect(() => {
    offsetRef.current = serverNowMs - Date.now();
    const id = setInterval(() => {
      const now = Date.now() + offsetRef.current;
      setNowMs(now);
      if (deadlineAtMs !== null && now >= deadlineAtMs) void submitRef.current(true);
    }, 1000);
    return () => clearInterval(id);
  }, [serverNowMs, deadlineAtMs]);

  const remaining = active ? Math.max(0, Math.ceil((active.deadlineAtMs - nowMs) / 1000)) : 0;

  async function submit(auto: boolean) {
    if (!active || submittedRef.current) return;
    submittedRef.current = !!auto;
    setBusy(true);
    setError(null);
    try {
      await chain.current;
      const res = await submitTestAction(access, active.testId, auto);
      setBusy(false);
      if (!res.ok) {
        submittedRef.current = false;
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      // The connection dropped: never stay stuck on "Mengirim...", let the applicant (or the clock) try again.
      setBusy(false);
      submittedRef.current = false;
      setError(CONNECTION_LOST);
    }
  }

  useEffect(() => {
    submitRef.current = submit;
  });

  function save(questionId: string, value: Answer) {
    if (!active) return;
    // A failed request must never break the chain, or every later save and the final send would hang with it.
    chain.current = chain.current.then(async () => {
      try {
        const res = await saveAnswerAction(access, active.testId, questionId, value);
        if (!res.ok && res.expired) router.refresh();
        else if (!res.ok) setError(res.error);
      } catch {
        setError(CONNECTION_LOST);
      }
    });
  }

  function choose(questionId: string, index: number) {
    setError(null);
    setAnswers((a) => ({ ...a, [questionId]: { index } }));
    save(questionId, { index });
  }

  function typeEssay(questionId: string, text: string) {
    setAnswers((a) => ({ ...a, [questionId]: { text } }));
    clearTimeout(essayTimers.current[questionId]);
    essayTimers.current[questionId] = setTimeout(() => save(questionId, { text }), 800);
  }

  async function start(testId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await startTestAction(access, testId);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setBusy(false);
      setError(CONNECTION_LOST);
    }
  }

  // ----- finished (or no longer in the test phase): a plain thank you -----
  if (state.candidate.status !== "TESTING") {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-xl font-extrabold text-[#231a28]">Terima kasih, {state.candidate.fullName}</h1>
        <p className="mt-2 text-sm text-[#4a3e52]">
          Jawaban Anda untuk lowongan {state.candidate.positionTitle} sudah kami terima. Tim HR akan menghubungi Anda jika Anda lanjut ke tahap berikutnya.
        </p>
        <p className="mt-3 text-xs text-[#8a7e92]">Halaman ini boleh ditutup.</p>
      </div>
    );
  }

  // ----- a test is running: every question on one page, answered in any order -----
  if (active) {
    const running = state.tests.find((t) => t.id === active.testId);
    const total = active.questions.length;
    // An essay counts once it is long enough; a scale or multiple-choice question once an option is picked.
    const isDone = (id: string) => (active.form === "ESSAY" ? (answers[id]?.text ?? "").trim().length >= ESSAY_MIN_CHARS : answers[id]?.index !== undefined);
    const missing = active.questions.map((x, n) => (isDone(x.id) ? -1 : n)).filter((n) => n >= 0);
    const answeredCount = total - missing.length;
    const canSubmit = missing.length === 0;
    const lowTime = remaining <= 60;
    const jump = (n: number) => document.getElementById(`soal-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

    return (
      <TestProtection watermarkName={state.candidate.fullName}>
      <div className="space-y-4">
        <div className="sticky top-0 z-10 rounded-xl border border-[#e6dcea] bg-white px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-extrabold text-[#231a28]">{running?.name}</h1>
            <span
              role="timer"
              aria-label="Sisa waktu"
              className={`rounded-full px-3 py-1 font-mono text-sm font-semibold ${lowTime ? "bg-[#fdecee] text-[#a1252f]" : "bg-[#fff6d6] text-[#7a5b00]"}`}
            >
              {formatClock(remaining)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eadfef]" role="presentation">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((answeredCount / total) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-[#8a7e92]">
            {answeredCount} dari {total} soal terjawab · salin dan tempel dinonaktifkan
          </p>
        </div>

        <ol className="space-y-4">
          {active.questions.map((q, n) => {
            const a = answers[q.id] ?? {};
            const essayLength = (a.text ?? "").length;
            return (
              <li key={q.id} id={`soal-${n}`} className="rounded-xl border border-[#e6dcea] bg-white p-5">
                <p className="text-xs font-bold text-brand">
                  Soal {n + 1} dari {total}
                </p>
                <p className={`mt-1 select-none text-[15px] font-semibold text-[#231a28] ${active.monospace ? "whitespace-pre-wrap break-all font-mono text-[14px] leading-7" : "whitespace-pre-line"}`}>{q.prompt}</p>

                {active.form === "SCALE" && (
                  <div className="mt-4">
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => choose(q.id, v)}
                          aria-pressed={a.index === v}
                          className={`rounded-lg border-2 py-3 text-base font-bold ${a.index === v ? "border-brand bg-brand text-white" : "border-[#cfc4d6] bg-white text-[#4a3e52] hover:border-brand"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-[#8a7e92]">
                      <span>{SCALE_LABELS[0]}</span>
                      <span>{SCALE_LABELS[4]}</span>
                    </div>
                  </div>
                )}

                {active.form === "MULTIPLE_CHOICE" && (
                  <div className="mt-4 space-y-2">
                    {q.options.map((opt) => (
                      <button
                        key={opt.index}
                        type="button"
                        onClick={() => choose(q.id, opt.index)}
                        aria-pressed={a.index === opt.index}
                        className={`block w-full select-none rounded-lg border-2 px-4 py-3 text-left text-[15px] ${a.index === opt.index ? "border-brand bg-[#f4eef5] font-semibold text-[#231a28]" : "border-[#cfc4d6] bg-white text-[#4a3e52] hover:border-brand"}`}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                )}

                {active.form === "ESSAY" && (
                  <div className="mt-4">
                    <textarea
                      value={a.text ?? ""}
                      onChange={(e) => typeEssay(q.id, e.target.value)}
                      onBlur={() => save(q.id, { text: a.text ?? "" })}
                      maxLength={ESSAY_MAX_CHARS}
                      rows={10}
                      placeholder="Tulis jawaban Anda di sini. Menempel teks tidak diizinkan."
                      aria-label={`Jawaban soal ${n + 1}`}
                      className="w-full rounded-lg border border-[#cfc4d6] px-3 py-2.5 text-[15px] focus:border-brand focus:outline-none"
                    />
                    <p className={`mt-1 text-xs ${essayLength >= ESSAY_MIN_CHARS ? "text-[#1d6b43]" : "text-[#8a7e92]"}`}>
                      {essayLength} karakter (minimal {ESSAY_MIN_CHARS})
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        {error && (
          <p role="alert" className="rounded-[10px] border border-[#f3c1c6] bg-[#fdecee] px-3 py-2.5 text-[13.5px] text-[#a1252f]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6dcea] bg-white p-5">
          <p className="text-xs text-[#8a7e92]">
            {canSubmit ? (
              "Semua soal sudah terjawab."
            ) : (
              <>
                {active.form === "ESSAY" ? `Tiap jawaban esai minimal ${ESSAY_MIN_CHARS} karakter. Belum lengkap:` : "Jawab semua soal dulu. Belum dijawab:"}{" "}
                {missing.map((n) => (
                  <button key={n} type="button" onClick={() => jump(n)} className="mr-1.5 font-semibold text-brand underline">
                    {n + 1}
                  </button>
                ))}
              </>
            )}
          </p>
          <button type="button" className={btnPrimary} disabled={!canSubmit || busy} onClick={() => submit(false)}>
            {busy ? "Mengirim..." : "Kirim tes"}
          </button>
        </div>
      </div>
      </TestProtection>
    );
  }

  // ----- between tests: what is next -----
  // Tes Situasi Kerja is always the first step; it has its own page, the other tests open after it.
  const assessment = state.assessment;
  const assessmentDone = assessment.status === "SUBMITTED";
  const assessmentHref = "token" in access ? `/cbp-recruitment/asesmen/${access.token}` : `/internal-jobs/asesmen/${access.candidateId}`;
  const next = assessmentDone ? state.tests.find((t) => t.canStart) : undefined;
  const nextIndex = next ? state.tests.indexOf(next) + 1 : -1;
  const stepCount = state.tests.length + 1;
  return (
    <div className="rounded-xl border border-[#e6dcea] bg-white p-5">
      <h1 className="text-xl font-extrabold text-[#231a28]">Halo, {state.candidate.fullName}</h1>
      <p className="text-sm text-[#6a5f72]">Lamaran: {state.candidate.positionTitle}</p>

      <ol className="mt-4 space-y-2">
        <li className="flex items-center justify-between gap-3 rounded-lg border border-[#eadfef] px-4 py-2.5 text-sm">
          <span className="font-semibold text-[#231a28]">
            1. {t("assessment.name")}
            {!assessment.unavailable && (
              <span className="ml-2 font-normal text-[#8a7e92]">
                {assessment.questionCount} soal · {assessment.timeLimitMinutes} menit
              </span>
            )}
          </span>
          <span className={assessmentDone ? "text-[#1d6b43]" : "text-[#8a7e92]"}>{assessmentDone ? "Selesai" : assessment.status === "IN_PROGRESS" ? "Berjalan" : "Belum"}</span>
        </li>
        {state.tests.map((t, i) => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#eadfef] px-4 py-2.5 text-sm">
            <span className="font-semibold text-[#231a28]">
              {i + 2}. {t.name}
              <span className="ml-2 font-normal text-[#8a7e92]">
                {t.questionCount} soal · {t.timeLimitMinutes} menit
              </span>
            </span>
            <span className={t.status === "SUBMITTED" ? "text-[#1d6b43]" : "text-[#8a7e92]"}>{t.status === "SUBMITTED" ? "Selesai" : "Belum"}</span>
          </li>
        ))}
      </ol>

      {!assessmentDone && (
        <div className="mt-5 rounded-lg bg-[#fff6d6] p-4 text-sm text-[#5c4710]">
          <b>
            Tes 1 dari {stepCount}: {t("assessment.name")}
          </b>
          {assessment.unavailable ? (
            <p className="mt-1">Tes ini belum tersedia. Silakan hubungi HR.</p>
          ) : (
            <>
              <p className="mt-1">
                {assessment.questionCount} situasi kerja dengan empat pilihan jawaban. Tidak ada jawaban benar atau salah, jawablah sesuai yang biasanya Anda lakukan. Tes ini dikerjakan lebih dulu; tes berikutnya terbuka setelah tes ini selesai.
              </p>
              <p className="mt-1">Waktu {assessment.timeLimitMinutes} menit mulai berjalan begitu Anda menekan Mulai, dan tidak bisa dihentikan. Jawaban tersimpan otomatis.</p>
              <Link href={assessmentHref} className={`${btnPrimary} mt-3 inline-block`}>
                {assessment.status === "IN_PROGRESS" ? "Lanjutkan" : `Mulai ${t("assessment.name")}`}
              </Link>
            </>
          )}
        </div>
      )}
      {next && (
        <div className="mt-5 rounded-lg bg-[#fff6d6] p-4 text-sm text-[#5c4710]">
          <b>
            Tes {nextIndex + 1} dari {stepCount}: {next.name}
          </b>
          {next.description && <p className="mt-1 whitespace-pre-line">{next.description}</p>}
          <p className="mt-1">
            Waktu {next.timeLimitMinutes} menit mulai berjalan begitu Anda menekan Mulai, dan tidak bisa dihentikan. Jawaban tersimpan otomatis. Jika waktu habis, jawaban terkirim sendiri.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-[10px] border border-[#f3c1c6] bg-[#fdecee] px-3 py-2.5 text-[13.5px] text-[#a1252f]">
          {error}
        </p>
      )}
      {next && (
        <div className="mt-4">
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => start(next.id)}>
            {busy ? "Memulai..." : `Mulai ${next.name}`}
          </button>
        </div>
      )}
    </div>
  );
}
