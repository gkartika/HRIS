"use client";

import { useActionState, useState } from "react";
import { startReviewRecruitmentRequest, decideRecruitmentRequest } from "../actions";
import { t } from "@/lib/i18n/id";

export function StartReviewButton({ requestId }: { requestId: string }) {
  const action = async () => {
    await startReviewRecruitmentRequest(requestId);
  };
  return (
    <form action={action}>
      <button
        type="submit"
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {t("recruitment.startReviewButton")}
      </button>
    </form>
  );
}

function DecisionButton({
  requestId,
  decision,
  label,
  tone,
  requireNote,
}: {
  requestId: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED";
  label: string;
  tone: string;
  requireNote: boolean;
}) {
  const [open, setOpen] = useState(false);
  const action = decideRecruitmentRequest.bind(null, requestId, decision);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`rounded-lg px-4 py-2 text-sm font-medium ${tone}`}
      >
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-500">
        {t("recruitment.decisionNote")} {requireNote && "(wajib)"}
      </label>
      <textarea name="decisionNote" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${tone}`}
        >
          {isPending ? t("common.loading") : label}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm text-slate-500"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function DecisionButtons({ requestId }: { requestId: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        requestId={requestId}
        decision="APPROVED"
        label={t("recruitment.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
      />
      <DecisionButton
        requestId={requestId}
        decision="RETURNED"
        label={t("recruitment.returnButton")}
        tone="border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
        requireNote={true}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECTED"
        label={t("recruitment.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
      />
    </div>
  );
}
