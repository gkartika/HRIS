"use client";

import { useActionState } from "react";
import { scheduleTrainingRequest } from "../actions";
import { t } from "@/lib/i18n/id";

interface SessionOption {
  id: string;
  startDate: Date;
  location: string | null;
}

export function ScheduleForm({ requestId, sessions }: { requestId: string; sessions: SessionOption[] }) {
  const [error, formAction, isPending] = useActionState(scheduleTrainingRequest.bind(null, requestId), undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      <div>
        <label className="mb-1 block text-xs text-slate-500">{t("trainingRequest.sessionLabel")}</label>
        <select name="sessionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">— Pilih Sesi —</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.startDate.toISOString().slice(0, 10)} {s.location ? `— ${s.location}` : ""}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? "Menjadwalkan..." : t("trainingRequest.scheduleButton")}
      </button>
    </form>
  );
}
