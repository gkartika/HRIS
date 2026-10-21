"use client";

import { useState, useTransition } from "react";
import { t } from "@/lib/i18n/id";
import type { AssessmentRunnerState } from "@/lib/recruitment-assessment-service";
import { saveAssessmentAnswerAction, startAssessmentAction, submitAssessmentAction, type AssessmentAccess } from "./asesmen-actions";

type ReadyState = Exclude<AssessmentRunnerState, { kind: "closed" }>;

const btnPrimary = "rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost = "rounded-full border border-[#cfc4d6] bg-white px-5 py-2.5 text-sm font-semibold text-[#4a3e52] hover:bg-[#f4eef5] disabled:cursor-not-allowed disabled:opacity-50";

// The applicant's page for Tes Situasi Kerja: instructions, then one situation per screen with four
// choices. Only the situation, the question and the choices are shown: no titles, dimensions or scores.
// Every choice is saved as it is made, so closing the page loses nothing. Copying is switched off
// (a deterrent, not a lock).
export function AssessmentRunner({ access, state }: { access: AssessmentAccess; state: ReadyState }) {
  const [started, setStarted] = useState(state.kind === "in-progress");
  const [done, setDone] = useState(state.kind === "done");
  const [answers, setAnswers] = useState<Record<string, string>>(state.answers);
  const firstOpen = Math.max(0, state.questions.findIndex((q) => !state.answers[q.id]));
  const [index, setIndex] = useState(firstOpen);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const total = state.questions.length;

  if (done) {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-lg font-bold text-[#231a28]">{t("assessment.candidate.doneTitle")}</h1>
        <p className="mt-2 text-sm text-[#6a5f72]">{state.closingText}</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="rounded-xl border border-[#e6dcea] bg-white p-6">
        <h1 className="text-lg font-bold text-[#231a28]">{state.title}</h1>
        <p className="mt-1 text-sm text-[#6a5f72]">Halo, {state.candidateName}.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#4a3e52]">
          {state.instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[#6a5f72]">{t("assessment.candidate.estimate", { min: state.estimatedMin, max: state.estimatedMax })}</p>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-5">
          <button
            type="button"
            className={btnPrimary}
            disabled={pending}
            onClick={() =>
              run(async () => {
                setError(null);
                const res = await startAssessmentAction(access);
                if (res.ok) setStarted(true);
                else setError(res.error);
              })
            }
          >
            {t("assessment.candidate.start")}
          </button>
        </div>
      </div>
    );
  }

  const question = state.questions[index];
  const chosen = answers[question.id];
  const missing = state.questions.filter((q) => !answers[q.id]).map((q) => q.questionNo);
  const isLast = index === total - 1;

  function choose(optionId: string) {
    const previous = answers[question.id];
    setAnswers((a) => ({ ...a, [question.id]: optionId }));
    setError(null);
    run(async () => {
      const res = await saveAssessmentAnswerAction(access, question.id, optionId);
      if (!res.ok) {
        // Put the previous choice back so the screen never shows an answer the server does not have.
        setAnswers((a) => {
          const next = { ...a };
          if (previous) next[question.id] = previous;
          else delete next[question.id];
          return next;
        });
        setError(res.error || t("assessment.candidate.saveFailed"));
      }
    });
  }

  return (
    <div
      className="rounded-xl border border-[#e6dcea] bg-white p-6"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ userSelect: "none" }}
    >
      <p className="text-xs font-semibold text-[#6a5f72]">{t("assessment.candidate.progress", { n: index + 1, total })}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#efe8f2]">
        <div className="h-full bg-brand" style={{ width: `${(Object.keys(answers).length / total) * 100}%` }} />
      </div>

      <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-[#231a28]">{question.scenario}</p>
      <h2 className="mt-3 text-base font-bold text-[#231a28]">{question.prompt}</h2>

      <fieldset className="mt-4 space-y-2.5" aria-label={`Soal ${index + 1}`}>
        {question.options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${chosen === o.id ? "border-brand bg-[#f7f0fa]" : "border-[#e6dcea] hover:bg-[#faf6fb]"}`}
          >
            <input type="radio" name={`q-${question.id}`} className="mt-1" checked={chosen === o.id} onChange={() => choose(o.id)} />
            <span>
              <span className="font-bold">{o.key}.</span> {o.text}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-5 min-h-5 text-xs">
        {pending && <span className="text-[#6a5f72]">{t("assessment.candidate.saving")}</span>}
        {error && <span className="text-rose-600">{error}</span>}
        {isLast && missing.length > 0 && !error && <span className="text-[#6a5f72]">{t("assessment.candidate.unanswered", { nomor: missing.join(", ") })}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={btnGhost} disabled={index === 0 || pending} onClick={() => setIndex(index - 1)}>
          {t("assessment.candidate.previous")}
        </button>
        {isLast ? (
          <button
            type="button"
            className={btnPrimary}
            disabled={pending || missing.length > 0}
            onClick={() =>
              run(async () => {
                setError(null);
                const res = await submitAssessmentAction(access);
                if (res.ok) setDone(true);
                else setError(res.error);
              })
            }
          >
            {pending ? t("assessment.candidate.sending") : t("assessment.candidate.submit")}
          </button>
        ) : (
          <button type="button" className={btnPrimary} disabled={pending || !chosen} onClick={() => setIndex(index + 1)}>
            {t("assessment.candidate.next")}
          </button>
        )}
      </div>
    </div>
  );
}
