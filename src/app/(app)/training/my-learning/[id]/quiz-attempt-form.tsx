"use client";

import { useActionState } from "react";
import { submitQuizAttempt } from "../actions";

interface QuizOptionView {
  id: string;
  optionText: string;
}
interface QuizQuestionView {
  id: string;
  questionText: string;
  questionType: string;
  options: QuizOptionView[];
}

// Never receives `isCorrect` — the answer key stays server-side, scored
// only in submitQuizAttempt (Key Control "Server-side quiz scoring").
export function QuizAttemptForm({ assignmentId, questions }: { assignmentId: string; questions: QuizQuestionView[] }) {
  const [error, formAction, isPending] = useActionState(submitQuizAttempt.bind(null, assignmentId), undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      {questions.map((q, idx) => (
        <div key={q.id}>
          <p className="mb-2 text-sm font-medium text-slate-800">
            {idx + 1}. {q.questionText}
          </p>
          <div className="space-y-1 pl-4">
            {q.options.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type={q.questionType === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} name={`answer_${q.id}`} value={o.id} />
                {o.optionText}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Mengirim..." : "Kirim Jawaban"}
      </button>
    </form>
  );
}
