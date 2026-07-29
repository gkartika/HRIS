"use client";

import { useActionState, useState } from "react";
import { decideMovementRequest, executeMovementRequest, cancelMovementRequest } from "../actions";
import { t } from "@/lib/i18n/id";

export interface DecisionPositionOption {
  positionId: string;
  positionCode: string;
  jobTitle: string;
}

function DecisionPositionField({ positions }: { positions: DecisionPositionOption[] }) {
  if (positions.length === 0) return null;
  if (positions.length === 1) {
    return <input type="hidden" name="decisionPositionId" value={positions[0].positionId} />;
  }
  return (
    <div>
      <label className="block text-xs text-slate-500">{t("recruitment.decisionPosition")}</label>
      <select name="decisionPositionId" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
        {positions.map((p) => (
          <option key={p.positionId} value={p.positionId}>
            {p.jobTitle} ({p.positionCode})
          </option>
        ))}
      </select>
    </div>
  );
}

function DecisionButton({
  requestId,
  decision,
  label,
  tone,
  requireNote,
  positions,
}: {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  label: string;
  tone: string;
  requireNote: boolean;
  positions: DecisionPositionOption[];
}) {
  const [open, setOpen] = useState(false);
  const action = decideMovementRequest.bind(null, requestId, decision);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tone}`}>
        {label}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <DecisionPositionField positions={positions} />
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
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function MovementDecisionButtons({
  requestId,
  positions,
}: {
  requestId: string;
  positions: DecisionPositionOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionButton
        requestId={requestId}
        decision="APPROVED"
        label={t("recruitment.approveButton")}
        tone="bg-emerald-600 text-white hover:bg-emerald-700"
        requireNote={false}
        positions={positions}
      />
      <DecisionButton
        requestId={requestId}
        decision="REJECTED"
        label={t("recruitment.rejectButton")}
        tone="border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        requireNote={true}
        positions={positions}
      />
    </div>
  );
}

export function ExecuteMovementButton({ requestId }: { requestId: string }) {
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const action = async () => {
    setIsPending(true);
    const result = await executeMovementRequest(requestId);
    setIsPending(false);
    setError(result);
  };
  return (
    <div>
      <form action={action}>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("movement.executeButton")}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function CancelMovementForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const action = cancelMovementRequest.bind(null, requestId);
  const [error, formAction, isPending] = useActionState(action, undefined);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
      >
        {t("recruitment.cancelRequestButton")}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <label className="block text-xs text-slate-600">{t("recruitment.cancellationReason")} (wajib)</label>
      <textarea name="cancellationReason" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {isPending ? t("common.loading") : t("recruitment.cancelRequestButton")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
