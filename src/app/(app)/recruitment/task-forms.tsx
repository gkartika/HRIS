"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { reviewEssayAction, submitInterviewFormAction } from "./candidate-actions";

const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
const label = "mb-1 block text-xs text-slate-500";
const primary = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60";

export function ReviewForm({ testId }: { testId: string }) {
  const router = useRouter();
  const action = reviewEssayAction.bind(null, testId);
  const [error, formAction, pending] = useActionState(action, undefined);
  const [decision, setDecision] = useState("");
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
      <fieldset>
        <legend className={label}>Hasil penilaian Anda</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="decision" value="LULUS" required checked={decision === "LULUS"} onChange={() => setDecision("LULUS")} />
            Lulus
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="decision" value="TIDAK_LULUS" checked={decision === "TIDAK_LULUS"} onChange={() => setDecision("TIDAK_LULUS")} />
            Tidak Lulus
          </label>
        </div>
      </fieldset>
      <div>
        <label className={label} htmlFor="review-note">
          Catatan {decision === "TIDAK_LULUS" ? "(wajib)" : "(opsional)"}
        </label>
        <textarea id="review-note" name="note" rows={3} className={input} />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <p className="text-xs text-slate-500">Keputusan tidak bisa diubah setelah dikirim.</p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Mengirim..." : "Kirim penilaian"}
      </button>
    </form>
  );
}

export function InterviewerForm({ interviewerId, aspects }: { interviewerId: string; aspects: { id: string; label: string }[] }) {
  const router = useRouter();
  const action = submitInterviewFormAction.bind(null, interviewerId);
  const [error, formAction, pending] = useActionState(action, undefined);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState("");

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
      className="space-y-5"
    >
      {aspects.length > 0 && (
        <div className="space-y-3">
          <p className={label}>Nilai tiap aspek: 1 (sangat kurang) sampai 5 (sangat baik)</p>
          {aspects.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-sm text-slate-900">{a.label}</span>
              <div className="flex gap-1.5" role="group" aria-label={a.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={scores[a.id] === n}
                    onClick={() => setScores((s) => ({ ...s, [a.id]: n }))}
                    className={`h-9 w-9 rounded-lg border text-sm font-semibold ${scores[a.id] === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {scores[a.id] && <input type="hidden" name={`score_${a.id}`} value={scores[a.id]} />}
            </div>
          ))}
        </div>
      )}

      <fieldset>
        <legend className={label}>Rekomendasi Anda</legend>
        <div className="flex flex-wrap gap-4">
          {[
            ["ACCEPTED", "Diterima"],
            ["CONSIDERED", "Dipertimbangkan"],
            ["REJECTED", "Ditolak"],
          ].map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="recommendation" value={value} required checked={recommendation === value} onChange={() => setRecommendation(value)} />
              {text}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className={label} htmlFor="iv-note">Catatan</label>
        <textarea id="iv-note" name="note" rows={4} className={input} />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <p className="text-xs text-slate-500">Penilaian tidak bisa diubah setelah dikirim. Hanya Anda dan HR Admin yang melihatnya sampai HR menetapkan hasil.</p>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Mengirim..." : "Kirim penilaian"}
      </button>
    </form>
  );
}
