"use client";

import { useActionState } from "react";
import { submitExitClearanceForm } from "../actions";

export interface ExitClearanceQuestionOption {
  id: string;
  questionText: string;
}

export function ExitClearanceEmployeeForm({
  caseId,
  questions,
}: {
  caseId: string;
  questions: ExitClearanceQuestionOption[];
}) {
  const action = submitExitClearanceForm.bind(null, caseId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <p className="text-sm font-medium text-slate-900">Formulir Klirens Keluar</p>
        <p className="mt-1 text-xs text-slate-500">
          Mohon isi formulir ini sebelum hari kerja terakhir Anda. Formulir hanya dapat diisi satu kali.
        </p>
      </div>
      {questions.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada pertanyaan yang aktif.</p>
      ) : (
        questions.map((q) => (
          <div key={q.id}>
            <label className="mb-1 block text-xs text-slate-500">{q.questionText}</label>
            <textarea
              name={`question-${q.id}`}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        ))
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending || questions.length === 0}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menyimpan..." : "Kirim Formulir"}
      </button>
    </form>
  );
}
