"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ESSAY_MAX_CHARS, ESSAY_MIN_CHARS, SCALE_LABELS, formatClock } from "@/lib/recruitment-candidates";
import type { RunnerState } from "@/lib/recruitment-service";
import { saveAnswerAction, startTestAction, submitTestAction, type TestAccess } from "./test-actions";

type Answer = { index?: number; text?: string };

const btnPrimary = "rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost = "rounded-full border border-[#cfc4d6] bg-white px-5 py-2.5 text-sm font-semibold text-[#4a3e52] hover:bg-[#f4eef5] disabled:cursor-not-allowed disabled:opacity-50";

// The test page for one applicant: the list of tests, one question per screen, a
// countdown that comes from the server's deadline, and answers saved as they are given.
// Copying and pasting inside the test is switched off (a deterrent, not a lock).
export function TestRunner(props: { access: TestAccess; state: RunnerState; serverNowMs: number }) {
  // A new key per test and per status makes each test start with fresh answers and from question 1.
  const key = props.state.active?.testId ?? props.state.tests.map((t) => t.status[0]).join("") + props.state.candidate.status;
  return <TestRunnerInner key={key} {...props} />;
}

function TestRunnerInner({ access, state, serverNowMs }: { access: TestAccess; state: RunnerState; serverNowMs: number }) {
  const router = useRouter();
  const active = state.active;
  const [answers, setAnswers] = useState<Record<string, Answer>>(active?.answers ?? {});
  const [qi, setQi] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(serverNowMs);
  const offsetRef = useRef(0);
  const submittedRef = useRef(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const essayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    await chain.current;
    const res = await submitTestAction(access, active.testId, auto);
    setBusy(false);
    if (!res.ok) {
      submittedRef.current = false;
      setError(res.error);
      return;
    }
    router.refresh();
  }

  useEffect(() => {
    submitRef.current = submit;
  });

  function save(questionId: string, value: Answer) {
    if (!active) return;
    chain.current = chain.current.then(async () => {
      const res = await saveAnswerAction(access, active.testId, questionId, value);
      if (!res.ok && res.expired) router.refresh();
      else if (!res.ok) setError(res.error);
    });
  }

  function choose(questionId: string, index: number) {
    setError(null);
    setAnswers((a) => ({ ...a, [questionId]: { index } }));
    save(questionId, { index });
  }

  function typeEssay(questionId: string, text: string) {
    setAnswers((a) => ({ ...a, [questionId]: { text } }));
    if (essayTimer.current) clearTimeout(essayTimer.current);
    essayTimer.current = setTimeout(() => save(questionId, { text }), 800);
  }

  async function start(testId: string) {
    setBusy(true);
    setError(null);
    const res = await startTestAction(access, testId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const blockClipboard = {
    onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    onCut: (e: React.ClipboardEvent) => e.preventDefault(),
    onPaste: (e: React.ClipboardEvent) => e.preventDefault(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

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

  // ----- a test is running: one question per screen -----
  if (active) {
    const running = state.tests.find((t) => t.id === active.testId);
    const q = active.questions[Math.min(qi, active.questions.length - 1)];
    const a = answers[q.id] ?? {};
    const isLast = qi >= active.questions.length - 1;
    const answeredCount = active.questions.filter((x) => {
      const v = answers[x.id];
      return active.form === "ESSAY" ? (v?.text ?? "").trim().length > 0 : v?.index !== undefined;
    }).length;
    const lowTime = remaining <= 60;
    const essayLength = (a.text ?? "").length;
    const canSubmit =
      active.form === "ESSAY"
        ? active.questions.every((x) => (answers[x.id]?.text ?? "").trim().length >= ESSAY_MIN_CHARS)
        : answeredCount === active.questions.length;

    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-5" {...blockClipboard}>
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
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eadfef]" role="presentation">
          <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(((qi + 1) / active.questions.length) * 100)}%` }} />
        </div>
        <p className="mt-2 text-xs text-[#8a7e92]">
          Soal {qi + 1} dari {active.questions.length} · salin dan tempel dinonaktifkan
        </p>

        <p className={`mt-4 select-none text-[15px] font-semibold text-[#231a28] ${active.monospace ? "whitespace-pre-wrap break-all font-mono text-[14px] leading-7" : "whitespace-pre-line"}`}>{q.prompt}</p>

        {active.form === "SCALE" && (
          <div className="mt-4">
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => choose(q.id, n)}
                  aria-pressed={a.index === n}
                  className={`rounded-lg border-2 py-3 text-base font-bold ${a.index === n ? "border-brand bg-brand text-white" : "border-[#cfc4d6] bg-white text-[#4a3e52] hover:border-brand"}`}
                >
                  {n}
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
              aria-label="Jawaban"
              className="w-full rounded-lg border border-[#cfc4d6] px-3 py-2.5 text-[15px] focus:border-brand focus:outline-none"
            />
            <p className={`mt-1 text-xs ${essayLength >= ESSAY_MIN_CHARS ? "text-[#1d6b43]" : "text-[#8a7e92]"}`}>
              {essayLength} karakter (minimal {ESSAY_MIN_CHARS})
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-[10px] border border-[#f3c1c6] bg-[#fdecee] px-3 py-2.5 text-[13.5px] text-[#a1252f]">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" className={btnGhost} disabled={qi === 0 || busy} onClick={() => setQi((i) => i - 1)}>
            Sebelumnya
          </button>
          {isLast ? (
            <button type="button" className={btnPrimary} disabled={!canSubmit || busy} onClick={() => submit(false)}>
              {busy ? "Mengirim..." : "Kirim tes"}
            </button>
          ) : (
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => setQi((i) => i + 1)}>
              Berikutnya
            </button>
          )}
        </div>
        {isLast && !canSubmit && (
          <p className="mt-2 text-right text-xs text-[#8a7e92]">
            {active.form === "ESSAY" ? `Tiap jawaban esai minimal ${ESSAY_MIN_CHARS} karakter.` : "Jawab semua soal dulu. Pakai tombol Sebelumnya untuk memeriksa."}
          </p>
        )}
      </div>
    );
  }

  // ----- between tests: what is next -----
  const next = state.tests.find((t) => t.canStart);
  const nextIndex = next ? state.tests.indexOf(next) : -1;
  return (
    <div className="rounded-xl border border-[#e6dcea] bg-white p-5">
      <h1 className="text-xl font-extrabold text-[#231a28]">Halo, {state.candidate.fullName}</h1>
      <p className="text-sm text-[#6a5f72]">Lamaran: {state.candidate.positionTitle}</p>

      <ol className="mt-4 space-y-2">
        {state.tests.map((t, i) => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#eadfef] px-4 py-2.5 text-sm">
            <span className="font-semibold text-[#231a28]">
              {i + 1}. {t.name}
              <span className="ml-2 font-normal text-[#8a7e92]">
                {t.questionCount} soal · {t.timeLimitMinutes} menit
              </span>
            </span>
            <span className={t.status === "SUBMITTED" ? "text-[#1d6b43]" : "text-[#8a7e92]"}>{t.status === "SUBMITTED" ? "Selesai" : "Belum"}</span>
          </li>
        ))}
      </ol>

      {next && (
        <div className="mt-5 rounded-lg bg-[#fff6d6] p-4 text-sm text-[#5c4710]">
          <b>
            Tes {nextIndex + 1} dari {state.tests.length}: {next.name}
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
