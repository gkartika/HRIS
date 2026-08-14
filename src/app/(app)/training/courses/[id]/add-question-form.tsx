"use client";

import { useActionState, useState } from "react";
import { addQuizQuestion } from "../actions";

const OPTION_SLOTS = [1, 2, 3, 4];

export function AddQuestionForm({ quizId }: { quizId: string }) {
  const [error, formAction, isPending] = useActionState(addQuizQuestion.bind(null, quizId), undefined);
  const [questionType, setQuestionType] = useState("SINGLE_CHOICE");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-slate-500">Pertanyaan</label>
          <input name="questionText" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Tipe Pertanyaan</label>
          <select
            name="questionType"
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="SINGLE_CHOICE">Pilihan Tunggal</option>
            <option value="MULTIPLE_CHOICE">Pilihan Ganda</option>
            <option value="TRUE_FALSE">Benar/Salah</option>
          </select>
        </div>
      </div>

      <div className="w-40">
        <label className="mb-1 block text-xs text-slate-500">Poin</label>
        <input name="points" type="number" min={1} defaultValue={1} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </div>

      {questionType === "TRUE_FALSE" ? (
        <div>
          <label className="mb-1 block text-xs text-slate-500">Jawaban Benar</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="trueFalseAnswer" value="true" required /> Benar
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="trueFalseAnswer" value="false" required /> Salah
            </label>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <p className="text-xs text-slate-500">
            Isi minimal 2 pilihan jawaban dan tandai kotak di sebelah jawaban yang benar
            {questionType === "SINGLE_CHOICE" ? " (tepat satu)." : " (satu atau lebih)."}
          </p>
          {OPTION_SLOTS.map((i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" name={`correct${i}`} title="Jawaban benar" />
              <input
                name={`option${i}`}
                placeholder={`Pilihan ${i}${i <= 2 ? " (wajib)" : ""}`}
                required={i <= 2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? "Menyimpan..." : "Tambah Pertanyaan"}
        </button>
      </div>
    </form>
  );
}
