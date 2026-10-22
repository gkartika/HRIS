"use client";

import { useEffect, useRef, useState } from "react";
import { TestProtection } from "@/components/test-protection";
import { t } from "@/lib/i18n/id";
import { formatClock } from "@/lib/recruitment-candidates";
import type { AssessmentQuestion, AssessmentRunnerState } from "@/lib/recruitment-assessment-service";
import { loadAssessmentQuestionsAction, saveAssessmentAnswerAction, startAssessmentAction, submitAssessmentAction, type AssessmentAccess } from "./asesmen-actions";

type ReadyState = Exclude<AssessmentRunnerState, { kind: "closed" }>;
type Phase = "intro" | "run" | "done" | "timeup";

const btnPrimary = "rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";

// The applicant's page for Tes Situasi Kerja: instructions, then all 20 situations on one page with four
// choices each, a 30-minute countdown that comes from the server, and every choice saved as it is made.
//
// Only the situation, the question and the choices are shown: no titles, dimensions or scores. The questions
// are fetched after Mulai, so they are not in the page's own source before the applicant starts.
//
// Copy protection is the shared TestProtection wrapper, the same as for every other test.
export function AssessmentRunner({ access, state }: { access: AssessmentAccess; state: ReadyState }) {
  const total = state.questionCount;
  const [phase, setPhase] = useState<Phase>(state.kind === "done" ? (state.timedOut ? "timeup" : "done") : state.kind === "in-progress" ? "run" : "intro");
  const [deadline, setDeadline] = useState<number | null>(state.deadlineAtMs);
  const [questions, setQuestions] = useState<AssessmentQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nowMs, setNowMs] = useState(state.serverNowMs);
  const offsetRef = useRef(0);
  const closingRef = useRef(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const finishRef = useRef<() => Promise<void>>(async () => {});
  const liveRef = useRef<{ phase: Phase; deadline: number | null }>({ phase, deadline });

  // Clock: the browser's clock only supplies the ticking; the zero point is the server's.
  // When it reaches zero the attempt is handed in as it stands (retried every second while the
  // server is still inside its few seconds of grace).
  useEffect(() => {
    offsetRef.current = state.serverNowMs - Date.now();
    const id = setInterval(() => {
      const now = Date.now() + offsetRef.current;
      setNowMs(now);
      const live = liveRef.current;
      if (live.phase === "run" && live.deadline !== null && now >= live.deadline) void finishRef.current();
    }, 1000);
    return () => clearInterval(id);
  }, [state.serverNowMs]);

  const remaining = deadline === null ? null : Math.max(0, Math.ceil((deadline - nowMs) / 1000));

  // The server closes the attempt: scored when all answers are in, otherwise closed without a score.
  async function finish() {
    if (closingRef.current) return;
    closingRef.current = true;
    setBusy(true);
    try {
      await chain.current;
      const res = await submitAssessmentAction(access);
      setBusy(false);
      if (!res.ok) {
        closingRef.current = false; // try again on the next tick (the server allows a few seconds of grace)
        setError(res.error);
        return;
      }
      setPhase(res.timedOut ? "timeup" : "done");
    } catch {
      // The connection dropped: never stay stuck on "Mengirim...", let the applicant (or the clock) try again.
      setBusy(false);
      closingRef.current = false;
      setError(t("assessment.candidate.connectionLost"));
    }
  }

  useEffect(() => {
    finishRef.current = finish;
    liveRef.current = { phase, deadline };
  });

  // The questions, once the attempt is running.
  useEffect(() => {
    if (phase !== "run") return;
    let cancelled = false;
    void loadAssessmentQuestionsAction(access)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setQuestions(res.questions);
          setError(null);
        } else {
          setError(res.error);
          // Closed on the server (time up): show the final screen.
          if (/ditutup|waktu/i.test(res.error)) void finish();
        }
      })
      .catch(() => {
        if (!cancelled) setError(t("assessment.candidate.connectionLost"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, access]);

  if (phase === "done" || phase === "timeup") {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-lg font-bold text-[#231a28]">{phase === "timeup" ? t("assessment.candidate.timeUpTitle") : t("assessment.candidate.doneTitle")}</h1>
        <p className="mt-2 text-sm text-[#6a5f72]">{phase === "timeup" ? t("assessment.candidate.timeUpBody") : state.closingText}</p>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-lg font-bold text-[#231a28]">{state.title}</h1>
        <p className="mt-1 text-sm text-[#6a5f72]">Halo, {state.candidateName}.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#4a3e52]">
          {state.instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-semibold text-[#4a3e52]">{t("assessment.candidate.timeRule", { menit: state.timeLimitMinutes })}</p>
        <p className="mt-1 text-sm text-[#6a5f72]">{t("assessment.candidate.timeRuleDetail")}</p>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-5">
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await startAssessmentAction(access);
                setBusy(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                offsetRef.current = res.serverNowMs - Date.now();
                setNowMs(res.serverNowMs);
                setDeadline(res.deadlineAtMs);
                setPhase("run");
              } catch {
                setBusy(false);
                setError(t("assessment.candidate.connectionLost"));
              }
            }}
          >
            {busy ? t("assessment.candidate.saving") : t("assessment.candidate.start")}
          </button>
        </div>
      </div>
    );
  }

  const answeredIds = new Set((questions ?? []).filter((q) => q.chosenOptionId !== null).map((q) => q.id));
  const missing = (questions ?? []).filter((q) => !answeredIds.has(q.id)).map((q) => q.questionNo);
  const answeredCount = (questions?.length ?? 0) - missing.length;
  const ready = questions !== null && questions.length === total;
  const low = remaining !== null && remaining <= 300;
  const veryLow = remaining !== null && remaining <= 60;
  const jump = (no: number) => document.getElementById(`soal-${no}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  function choose(question: AssessmentQuestion, optionId: string) {
    const previous = question.chosenOptionId;
    setQuestions((qs) => (qs ?? []).map((q) => (q.id === question.id ? { ...q, chosenOptionId: optionId } : q)));
    setError(null);
    setSaving(true);
    // Saves go one after the other, so the last click is the one that is kept.
    // A failed request must never break the chain, or every later save and the final send would hang with it.
    chain.current = chain.current.then(async () => {
      const revert = (message: string) => {
        setQuestions((qs) => (qs ?? []).map((q) => (q.id === question.id ? { ...q, chosenOptionId: previous } : q)));
        setError(message);
      };
      try {
        const res = await saveAssessmentAnswerAction(access, question.id, optionId);
        setSaving(false);
        if (!res.ok) {
          revert(res.error || t("assessment.candidate.saveFailed"));
          if (/waktu/i.test(res.error)) void finish();
        }
      } catch {
        setSaving(false);
        revert(t("assessment.candidate.saveFailed"));
      }
    });
  }

  return (
    <TestProtection watermarkName={state.candidateName}>
    <div className="space-y-3">
      <div className="sticky top-0 z-10 rounded-xl border border-[#e6dcea] bg-white px-4 py-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#4a3e52]">{t("assessment.candidate.answeredOf", { n: answeredCount, total })}</span>
          <span className={`font-mono text-base font-bold ${veryLow ? "text-rose-600" : low ? "text-amber-600" : "text-[#4a3e52]"}`} aria-live="off">
            {t("assessment.candidate.timeLeft")} {formatClock(remaining ?? 0)}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe8f2]">
          <div className="h-full bg-brand transition-all" style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }} />
        </div>
        {low && <p className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${veryLow ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{t(veryLow ? "assessment.candidate.timeWarnLast" : "assessment.candidate.timeWarn")}</p>}
      </div>

      <div>
        {!questions ? (
          <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
            <p className="py-10 text-center text-sm text-[#6a5f72]">{error ?? t("assessment.candidate.loadingQuestion")}</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {questions.map((q) => (
              <li key={q.id} id={`soal-${q.questionNo}`} className="rounded-xl border border-[#e6dcea] bg-white p-5">
                <p className="text-xs font-bold text-brand">{t("assessment.candidate.progress", { n: q.questionNo, total })}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#231a28]">{q.scenario}</p>
                <h2 className="mt-3 text-base font-bold text-[#231a28]">{q.prompt}</h2>
                <fieldset className="mt-3 space-y-2.5" aria-label={`Soal ${q.questionNo}`}>
                  {q.options.map((o) => (
                    <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${q.chosenOptionId === o.id ? "border-brand bg-[#f7f0fa]" : "border-[#e6dcea] hover:bg-[#faf6fb]"}`}>
                      <input type="radio" name={`q-${q.id}`} className="mt-1" checked={q.chosenOptionId === o.id} onChange={() => choose(q, o.id)} />
                      <span>
                        <span className="font-bold">{o.key}.</span> {o.text}
                      </span>
                    </label>
                  ))}
                </fieldset>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="min-h-5 text-xs">
        {saving && <span className="text-[#6a5f72]">{t("assessment.candidate.saving")}</span>}
        {error && questions && <span className="text-rose-600">{error}</span>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6dcea] bg-white p-5">
        <p className="text-xs text-[#6a5f72]">
          {!ready ? "" : missing.length === 0 ? t("assessment.candidate.allAnswered") : (
            <>
              {t("assessment.candidate.unansweredLead")}{" "}
              {missing.map((n) => (
                <button key={n} type="button" className="mr-1.5 font-semibold text-brand underline" onClick={() => jump(n)}>
                  {n}
                </button>
              ))}
            </>
          )}
        </p>
        <button type="button" className={btnPrimary} disabled={busy || saving || !ready || missing.length > 0} onClick={() => void finish()}>
          {busy ? t("assessment.candidate.sending") : t("assessment.candidate.submit")}
        </button>
      </div>
    </div>
    </TestProtection>
  );
}
